function addTask(){
      var title=clean(state.draft);if(!title){toast("할 일을 먼저 입력해 주세요.");return}
      var task={id:uid(),title:title,startText:clean(state.startText),memoText:cleanMemo(state.memoText),finishText:clean(state.finishText),type:state.type,prep:!!state.prep,count:clamp(state.count,1,6),now:0,view:0,settingsOpen:false,pieces:[]};
      task.pieces=makePieces(task);task.count=task.pieces.length;state.tasks.unshift(task);state.activeId=task.id;state.libraryOpen=false;state.selectedLibraryId=null;clearDraft();resetTimer(TIMER.FOCUS);state.screen="do";
      saveState();syncInputs();renderAll();toast("할 일을 추가했어요.");
    }
    function resetAddSettings(){state.startText="";state.finishText="";state.count=1;state.prep=false;state.addSettingsOpen=false}
    function clearDraft(){armedDraftClear=false;state.draft="";state.memoText="";state.type=TYPE.STUDY;resetAddSettings()}
    function isAddDraftDirty(){return !!(clean(state.draft)||cleanMemo(state.memoText)||clean(state.startText)||clean(state.finishText)||state.type!==TYPE.STUDY||clamp(state.count,1,6)!==1||!!state.prep||!!state.addSettingsOpen)}
    function clearAddDraftFromButton(){
      if(!isAddDraftDirty())return;
      if(!armedDraftClear){armedDraftClear=true;renderAddControls();return}
      clearDraft();saveState();syncInputs();renderAddControls();toast("비웠어요.");focusTaskInput();
    }
    function selectTask(taskId){var task=findTask(taskId);if(!task)return;armedDeleteId=null;armedDraftClear=false;editDraft=null;state.activeId=task.id;state.libraryOpen=false;state.selectedLibraryId=null;task.settingsOpen=false;task.view=Math.min(task.now,task.pieces.length-1);resetTimer(TIMER.FOCUS);saveState();renderAll()}
    function putAwayCurrent(){var task=activeTask();if(!task)return;editDraft=null;task.settingsOpen=false;state.activeId=null;state.libraryOpen=false;state.selectedLibraryId=null;resetTimer(TIMER.FOCUS);saveState();renderAll();toast("보관함으로 내렸어요.")}
    function shelfCurrentDone(){var task=activeTask();if(!task||!isTaskDone(task))return;editDraft=null;task.settingsOpen=false;task.doneShelf=true;task.doneShelfAt=Date.now();state.activeId=null;state.libraryOpen=false;state.selectedLibraryId=null;resetTimer(TIMER.FOCUS);saveState();renderAll();toast("끝낸 일로 치웠어요.")}
    function moveTaskToDoneShelf(taskId){var task=findTask(taskId);if(!task||!isTaskDone(task))return;armedDeleteId=null;task.doneShelf=true;task.doneShelfAt=Date.now();if(state.selectedLibraryId===task.id)state.selectedLibraryId=null;state.libraryOpen=true;saveState();renderTaskListStable();toast("끝낸 일로 치웠어요.")}
    function restoreTaskFromDoneShelf(taskId){var task=findTask(taskId);if(!task)return;armedDeleteId=null;task.doneShelf=false;task.doneShelfAt=undefined;if(state.selectedLibraryId===task.id)state.selectedLibraryId=null;state.libraryOpen=true;saveState();renderTaskListStable();toast("보관함으로 꺼냈어요.")}
    function deleteDoneShelfTask(taskId){
      var task=findTask(taskId);if(!task||!task.doneShelf)return;
      if(armedDeleteId!==taskId){armedDeleteId=taskId;state.libraryOpen=true;saveState();renderTaskListStable();return}
      if(window.StepDataSafety)window.StepDataSafety.allowDestructiveOnce("task-delete");
      state.tasks=state.tasks.filter(function(item){return item.id!==task.id});
      if(state.selectedLibraryId===task.id)state.selectedLibraryId=null;
      armedDeleteId=null;state.libraryOpen=true;saveState("task-delete");renderTaskListStable();toast("삭제했어요.");
    }
    function openAddView(){armedDeleteId=null;armedDraftClear=false;editDraft=null;state.screen="add";saveState();renderScreen();renderAddControls();syncInputs();focusTaskInput()}
    function markCurrent(status){
      var task=activeTask();if(!task||task.now>=task.pieces.length)return;
      var index=task.now;task.pieces[index].status=validStatus(status);
      if(status===STATUS.INCOMPLETE)task.pieces.splice(index+1,0,newPiece(KIND.INCOMPLETE));
      if(status===STATUS.BLOCKED)task.pieces.splice(index+1,0,newPiece(KIND.BLOCKED));
      recalcTask(task);resetTimer(TIMER.FOCUS);
      var justFinished=status===STATUS.SUCCESS&&isTaskDone(task);saveState();renderAll();if(justFinished)showCelebration();
    }
    function addOnePiece(){var task=activeTask();if(!task)return;var wasDone=isTaskDone(task);task.pieces.push(newPiece(KIND.CONTINUE));refreshKinds(task);recalcTask(task);if(wasDone)resetTimer(TIMER.FOCUS);saveState();renderAll();toast("Step을 하나 늘렸어요.")}
    function removeOnePiece(){
      var task=activeTask();if(!task)return;
      if(task.pieces.length<=1){toast("마지막 Step은 삭제할 수 없어요.");return}
      var wasDone=isTaskDone(task),removeIndex=findLastPendingIndex(task);
      if(removeIndex<0){toast("줄일 수 있는 예정 Step이 없어요.");return}
      task.pieces.splice(removeIndex,1);refreshKinds(task);recalcTask(task);var nowDone=isTaskDone(task);if(nowDone)resetTimer(TIMER.FOCUS);saveState();renderAll();
      if(!wasDone&&nowDone){toast("남은 Step을 줄여서 완료했어요.");showCelebration()}else toast("예정 Step을 하나 줄였어요.");
    }
    function deleteTask(taskId){
      if(armedDeleteId!==taskId){armedDeleteId=taskId;renderCurrent();return}
      editDraft=null;
      if(window.StepDataSafety)window.StepDataSafety.allowDestructiveOnce("task-delete");
      state.tasks=state.tasks.filter(function(task){return task.id!==taskId});if(state.activeId===taskId){state.activeId=null;resetTimer(TIMER.FOCUS)}armedDeleteId=null;saveState("task-delete");renderAll();toast("삭제했어요.");
    }
    function toggleStep(index){
      var task=activeTask(),piece=viewPiece(task);
      if(!task||!piece)return;
      var pieceIndex=clamp(task.view,0,Math.max(task.pieces.length-1,0));
      if(pieceIndex!==task.now||task.now>=task.pieces.length)return;
      var max=getStepChecklist(task,pieceIndex).length;
      if(index<0||index>=max)return;
      while(piece.done.length<max)piece.done.push(false);
      piece.done[index]=!piece.done[index];
      saveState();renderCurrent();
    }
