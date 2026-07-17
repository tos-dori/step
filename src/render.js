function renderAll(){renderScreen();renderAddControls();renderCurrent();autoGrowAll()}
    function renderScreen(){var add=state.screen==="add";document.body.classList.toggle("add-mode",add);el.addView.classList.toggle("active",add);el.doView.classList.toggle("active",!add);el.topBtn.textContent=add?"닫기":"＋";el.topBtn.classList.toggle("close",add);el.subtitle.textContent=add?"새 할 일 만들기":"지금 할 것만 보기"}
    function addButtonText(){var count=clamp(state.count,1,6);return "＋ "+count+" Step 만들기"}
    function updateAddButton(){el.addBtn.disabled=!clean(state.draft);el.addBtn.textContent=addButtonText()}
    function renderAddControls(){updateAddButton();el.prepInput.checked=!!state.prep;if(el.clearDraftBtn){var dirty=isAddDraftDirty()&&state.screen==="add";el.clearDraftBtn.hidden=!dirty;el.clearDraftBtn.classList.toggle("armed",!!armedDraftClear&&dirty);el.clearDraftBtn.textContent=(armedDraftClear&&dirty)?"🗑 비우기 확인":"🗑 비우기"}if(el.addSettingsToggle)el.addSettingsToggle.setAttribute("aria-expanded",state.addSettingsOpen?"true":"false");if(el.addSettingsState)el.addSettingsState.textContent=state.addSettingsOpen?"접기":"열기";if(el.addSettingsCard)el.addSettingsCard.classList.toggle("collapsed",!state.addSettingsOpen);applyMemoGuide();all("[data-type]").forEach(function(btn){btn.classList.toggle("on",Number(btn.dataset.type)===state.type)});all("[data-count]").forEach(function(btn){btn.classList.toggle("on",Number(btn.dataset.count)===state.count)})}
    function syncInputs(){el.taskInput.value=state.draft;el.startInput.value=state.startText;el.memoInput.value=state.memoText;el.finishInput.value=state.finishText;el.prepInput.checked=!!state.prep;updateAddButton();applyMemoGuide();autoGrow(el.memoInput)}
    function renderCurrent(){
      var task=activeTask();if(!task){renderEmptyCurrent();renderTaskList();return}
      if(task.settingsOpen){renderEditTask(task);return}
      if(isTaskDone(task)){renderDoneTask(task);return}
      var piece=viewPiece(task),viewIndex=clamp(task.view,0,Math.max(task.pieces.length-1,0)),isCurrent=viewIndex===task.now&&task.now<task.pieces.length;
      if(!piece){renderDoneTask(task);return}
      el.currentCard.innerHTML=renderTaskHeader(task,false,"")+renderMeta(task,isCurrent)+renderProgressBar(task,true)+renderTimePlan(task)+'<div class="steps">'+renderSteps(task,piece,viewIndex)+'</div>'+renderResultButtons("current",!isCurrent);
      bindCurrentCard(task,isCurrent);renderTaskList();updateTimerDom();autoGrowAll();
    }
    function renderEditTask(task){
      var draft=ensureEditDraft(task);
      el.currentCard.innerHTML=renderEditForm(task,draft);
      bindEditForm(task,draft);renderTaskList();autoGrowAll();
    }
    function renderEditForm(task,draft){
      var prepEdit=canEditPrep(task)?'<label class="small-check"><input id="prepEditInput" type="checkbox" '+(draft.prep?'checked':'')+' /><span>첫 Step 앞에 준비 체크 넣기</span></label>':'';
      return '<div class="edit-form"><div class="edit-top">'+renderTypeEditRow(draft)+'<div class="edit-controls">'+gearButton(true)+'<button class="gear edit-save" id="saveEditBtn" aria-label="편집 저장">'+checkSvg()+'</button></div></div>'+ 
        '<input class="add-title-field edit-title-field" id="titleEditInput" type="text" value="'+attr(draft.title)+'" aria-label="제목 수정" autocomplete="off" />'+
        renderMemoEdit(draft,false)+
        '<div class="edit-divider"></div><div class="edit-settings">'+
        '<div class="setting-section"><div class="label">시작·끝 기준</div><div class="range-box"><label class="range-row"><span>시작</span><input id="startEditInput" type="text" value="'+attr(draft.startText)+'" placeholder="처음 볼 곳이나 손댈 것" autocomplete="off" /></label><label class="range-row"><span>끝</span><input id="finishEditInput" type="text" value="'+attr(draft.finishText)+'" placeholder="이번에 어디까지 할지" autocomplete="off" /></label></div>'+prepEdit+'</div>'+ 
        '<div class="setting-section"><div class="label">전체 분량</div><div class="size-row"><button class="size-btn" id="minusPiece">− Step</button><button class="size-btn" id="plusPiece">＋ Step</button></div></div>'+ 
        '<div class="edit-actions"><button class="putaway-btn" id="putAwayBtn">↓ 보관함으로 내리기</button><button class="delete-btn '+(armedDeleteId===task.id?'armed':'')+'" id="deleteBtn">'+(armedDeleteId===task.id?'🗑 삭제 확인':'🗑 이 할 일 삭제')+'</button></div>'+ 
        '</div></div>';
    }
    function renderTaskHeader(task,done,badgeText){
      var titlePart='<h2 class="now-title">'+safe(task.title||"할 일")+'</h2>';
      var badge=badgeText?'<div class="badge '+(done?'done':'')+'">'+badgeText+'</div>':'';
      return '<div class="now-head"><div class="title-line">'+typeBadge(task)+titlePart+'</div><div class="head-right">'+badge+gearButton(false)+'</div></div>';
    }
    function editSvg(open){
      return open?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12"></path><path d="M18 6L6 18"></path></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg>';
    }
    function checkSvg(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5"></path></svg>'}
    function gearButton(open){return '<button class="gear '+(open?'on':'')+'" id="gearBtn" aria-label="'+(open?'편집 취소':'할 일 편집')+'">'+editSvg(open)+'</button>'}
    function renderTypeEditRow(task){return '<div class="edit-type-row"><button class="chip '+(task.type===TYPE.STUDY?'on':'')+'" data-edit-type="0">공부</button><button class="chip '+(task.type===TYPE.ASSIGNMENT?'on':'')+'" data-edit-type="1">과제</button><button class="chip '+(task.type===TYPE.ETC?'on':'')+'" data-edit-type="2">기타</button></div>'}
    function renderMeta(task,showTimer){
      var memo=renderMemo(task,false),timer=showTimer?renderTimer():"";
      if(!memo&&!timer)return'<div class="meta-row meta-spacer" aria-hidden="true"></div>';
      return '<div class="meta-row '+(memo?"has-memo":"solo-timer")+(timer?" with-timer":" no-timer")+'">'+memo+timer+'</div>';
    }
    function renderEmptyCurrent(){
      var hasStored=storedTasks().length>0,actionsClass=hasStored?"empty-actions":"empty-actions single";
      el.currentCard.innerHTML='<div class="label">지금 할 것</div><div class="empty"><strong>지금 할 일을 비워뒀어요</strong>쉬거나, 수업 가거나, 보관함에서 다시 골라도 됩니다.<div class="'+actionsClass+'"><button class="soft-action primary" id="emptyAddBtn">새 할 일 추가</button>'+(hasStored?'<button class="soft-action" id="emptyLibraryBtn">보관함 열기</button>':'')+'</div></div>';
      var add=byId("emptyAddBtn"),lib=byId("emptyLibraryBtn");if(add)add.onclick=openAddView;if(lib)lib.onclick=function(){state.libraryOpen=true;state.selectedLibraryId=null;saveState();renderTaskList()};
    }
    function renderDoneTask(){
      var task=activeTask();
      if(task&&task.settingsOpen){renderEditTask(task);return}
      el.currentCard.innerHTML=renderTaskHeader(task,false,"")+renderMemo(task,true)+renderProgressBar(task,true)+'<div class="done-title"><span class="done-check">✓</span><span>할 일 완료</span></div><div class="done-actions"><button class="done-action primary" id="doneAddBtn">새 할 일 추가</button><button class="done-action" id="doneKeepBtn">보관함에 두기</button></div><div class="done-secondary-actions"><button class="done-shelf-final" id="doneShelfBtn">끝낸 일로 치우기</button><button class="done-delete-final '+(armedDeleteId===task.id?'armed':'')+'" id="doneDeleteBtn">'+(armedDeleteId===task.id?'🗑 삭제 확인':'🗑 삭제')+'</button></div>';
      bindGear(task);bindDoneActions();bindMemoTokens(task);renderTaskList();autoGrowAll();
    }
    function bindDoneActions(){var add=byId("doneAddBtn"),keep=byId("doneKeepBtn"),shelf=byId("doneShelfBtn"),del=byId("doneDeleteBtn");if(add)add.onclick=openAddView;if(keep)keep.onclick=putAwayCurrent;if(shelf)shelf.onclick=shelfCurrentDone;if(del)del.onclick=function(){var task=activeTask();if(task)deleteTask(task.id)}}
    function renderMemo(task,standalone){return task.memoText?'<div class="memo-shell readonly '+(standalone?'standalone':'')+'"><div class="memo-content">'+renderMemoText(task.memoText)+'</div></div>':''}
    function renderMemoEdit(task,standalone){var guide=memoGuide(task.type);return'<div class="memo-edit-block '+(standalone?'standalone':'')+'"><div class="add-field-label">메모</div><div class="memo-helper-row"><div class="memo-help">'+renderMemoHelp(task.type)+'</div><button type="button" class="memo-check-insert" id="memoInlineInsertBtn">○ 체크</button></div><label class="memo-shell editable memo-edit-shell"><textarea class="memo-field" id="memoInlineInput" placeholder="'+attr(guide.placeholder)+'" rows="2">'+safe(task.memoText)+'</textarea></label></div>'}
    function renderSteps(task,piece,pieceIndex){
      var readonly=pieceIndex!==task.now||task.now>=task.pieces.length;
      return getStepChecklist(task,pieceIndex).map(function(item,index){
        var checked=!!piece.done[index],cls="step "+(item.muted?"prep-check ":"")+(readonly?"readonly ":"")+(checked?"checked":"");
        var action=readonly?' disabled aria-disabled="true"':' data-step="'+index+'"';
        return'<button type="button" class="'+cls+'"'+action+'><div class="num">'+(checked?'✓':item.number)+'</div><div><span class="step-line">'+renderLine(item.parts)+'</span></div></button>'
      }).join("")
    }
    function renderLine(parts){return parts.map(function(part){var escaped=safe(part.text);return part.strong?'<strong>'+escaped+'</strong>':escaped}).join("")}
    function circledStepNumber(value){value=Number(value);if(value>=1&&value<=20)return String.fromCharCode(0x2460+value-1);return String(value)}
    function formatClock(date){return pad2(date.getHours())+":"+pad2(date.getMinutes())}
    function nextHalfHour(now){var slot=30*60*1000;return new Date(Math.floor(now.getTime()/slot)*slot+slot)}
    function timePlanHtml(task){
      if(!task||isTaskDone(task)||task.now>=task.pieces.length)return "";
      var now=new Date(),end=nextHalfHour(now),html="";
      for(var i=0;i<task.pieces.length;i++){
        if(task.pieces[i].status!==STATUS.PENDING||i<task.now){
          html+='<span class="time-mark blank" aria-hidden="true">·</span>';
          continue;
        }
        html+='<span class="time-mark '+(i===task.now?'now':'')+'">~'+formatClock(end)+'</span>';
        end=new Date(end.getTime()+30*60*1000);
      }
      return html;
    }
    function renderTimePlan(task){var html=timePlanHtml(task);return html?'<div class="time-plan" id="timePlan" style="--step-count:'+task.pieces.length+'">'+html+'</div>':''}
    function updateTimePlanDom(){var node=byId("timePlan");if(!node)return;var task=activeTask();var html=timePlanHtml(task);if(html){node.style.setProperty("--step-count",task.pieces.length);node.innerHTML=html}else node.remove()}
    function renderProgressBar(task,interactive){return '<div class="bar">'+renderBar(task,interactive)+'</div>'}
    function renderBar(task,interactive){
      var view=typeof task.view==="number"?task.view:task.now;
      return task.pieces.map(function(piece,index){var cls="seg "+piece.status;if(piece.status===STATUS.PENDING&&index===task.now)cls="seg current";if(interactive&&index===view)cls+=" viewing";return interactive?'<button class="'+cls+'" data-piece="'+index+'" aria-label="Step '+(index+1)+'"></button>':'<span class="'+cls+'"></span>'}).join("");
    }
    function renderResultButtons(prefix,locked){return'<div class="actions">'+resultButton("success",prefix+"-success","✓ 성공",locked)+resultButton("incomplete",prefix+"-incomplete","… 미완",locked)+resultButton("blocked",prefix+"-blocked","! 멈춤",locked)+'</div>'}
    function resultButton(cls,key,label,locked){return'<button class="result-btn '+cls+(locked?' locked" disabled':'"')+' data-hold="'+key+'"><span class="hold-fill"></span><span class="hold-label">'+label+'</span></button>'}
    function bindCurrentCard(task,enableHold){
      bindGear(task);bindTimer();bindMemoTokens(task);
      all("[data-piece]",el.currentCard).forEach(function(btn){btn.onclick=function(){armedDeleteId=null;task.view=Number(btn.dataset.piece);saveState();renderCurrent()}});
      all("[data-step]",el.currentCard).forEach(function(btn){btn.onclick=function(){toggleStep(Number(btn.dataset.step))}});
      if(enableHold){bindHold('[data-hold="current-success"]',function(){markCurrent(STATUS.SUCCESS)},el.currentCard);bindHold('[data-hold="current-incomplete"]',function(){markCurrent(STATUS.INCOMPLETE)},el.currentCard);bindHold('[data-hold="current-blocked"]',function(){markCurrent(STATUS.BLOCKED)},el.currentCard)}
    }
    function bindEditForm(task,draft){
      bindEditDraftInputs(task,draft);
      var cancel=byId("gearBtn"),save=byId("saveEditBtn"),put=byId("putAwayBtn"),minus=byId("minusPiece"),plus=byId("plusPiece"),del=byId("deleteBtn"),prepInput=byId("prepEditInput");
      if(cancel)cancel.onclick=function(){closeEditWithoutSave(task)};
      if(save)save.onclick=function(){saveEditDraft(task)};
      if(put)put.onclick=function(){putAwayEditedTask(task)};
      if(minus)minus.onclick=function(){removeDraftPiece(task)};
      if(plus)plus.onclick=function(){addDraftPiece(task)};
      if(del)del.onclick=function(){deleteTask(task.id)};
      if(prepInput)prepInput.addEventListener("change",function(){draft.prep=prepInput.checked;refreshKinds(draft)});
      all("[data-edit-type]",el.currentCard).forEach(function(btn){
        btn.onclick=function(){draft.type=clamp(btn.dataset.editType,TYPE.STUDY,TYPE.ETC);refreshKinds(draft);renderEditTask(task)};
      });
    }
    function bindEditDraftInputs(task,draft){
      var titleInput=byId("titleEditInput"),memoInput=byId("memoInlineInput"),startInput=byId("startEditInput"),finishInput=byId("finishEditInput"),insertBtn=byId("memoInlineInsertBtn");
      if(titleInput)titleInput.addEventListener("input",function(){draft.title=titleInput.value});
      if(memoInput){autoGrow(memoInput);memoInput.addEventListener("input",function(){draft.memoText=memoInput.value;autoGrow(memoInput)});bindInsertButton(insertBtn,memoInput,function(){return function(value){draft.memoText=value}})}
      if(startInput)startInput.addEventListener("input",function(){draft.startText=startInput.value});
      if(finishInput)finishInput.addEventListener("input",function(){draft.finishText=finishInput.value});
    }
    function bindGear(task){
      var gear=byId("gearBtn");
      if(gear)gear.onclick=function(){armedDeleteId=null;editDraft=draftFromTask(task);task.settingsOpen=true;saveState();renderCurrent()};
    }
