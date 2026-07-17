function clonePiece(piece){return{status:validStatus(piece.status),kind:validKind(piece.kind)||KIND.CONTINUE,done:Array.isArray(piece.done)?piece.done.map(Boolean).slice(0,4):[false,false,false]}}
    function clonePieces(pieces){return (pieces||[]).map(clonePiece)}
    function draftFromTask(task){return{id:task.id,title:task.title,startText:task.startText,memoText:task.memoText,finishText:task.finishText,type:task.type,prep:task.prep,count:task.pieces.length,now:task.now,view:task.view,pieces:clonePieces(task.pieces)}}
    function ensureEditDraft(task){if(!editDraft||editDraft.id!==task.id)editDraft=draftFromTask(task);return editDraft}
    function closeEditWithoutSave(task){editDraft=null;armedDeleteId=null;task.settingsOpen=false;saveState();renderCurrent()}
    function applyEditDraftToTask(task){
      var draft=ensureEditDraft(task),title=clean(draft.title)||task.title||"할 일";
      task.title=title;task.startText=clean(draft.startText);task.memoText=cleanMemo(draft.memoText);task.finishText=clean(draft.finishText);task.type=clamp(draft.type,TYPE.STUDY,TYPE.ETC);
      if(canEditPrep(task))task.prep=!!draft.prep;
      task.pieces=clonePieces(draft.pieces);if(!task.pieces.length)task.pieces=makePieces(task);
      refreshKinds(task);recalcTask(task);task.view=clamp(typeof draft.view==="number"?draft.view:task.view,0,Math.max(task.pieces.length-1,0));
    }
    function saveEditDraft(task){
      applyEditDraftToTask(task);
      task.settingsOpen=false;editDraft=null;armedDeleteId=null;
      saveState();renderCurrent();toast("저장했어요.");
    }
    function putAwayEditedTask(task){
      if(!task)return;
      applyEditDraftToTask(task);
      task.settingsOpen=false;editDraft=null;armedDeleteId=null;
      state.activeId=null;state.libraryOpen=false;state.selectedLibraryId=null;resetTimer(TIMER.FOCUS);
      saveState();renderAll();toast("저장하고 보관함으로 내렸어요.");
    }
    function addDraftPiece(task){var draft=ensureEditDraft(task);draft.pieces.push(newPiece(KIND.CONTINUE));draft.count=draft.pieces.length;refreshKinds(draft);renderEditTask(task);toast("Step을 하나 늘렸어요.")}
    function removeDraftPiece(task){
      var draft=ensureEditDraft(task);
      if(draft.pieces.length<=1){toast("마지막 Step은 삭제할 수 없어요.");return}
      var removeIndex=findLastPendingIndex(draft);
      if(removeIndex<0){toast("줄일 수 있는 예정 Step이 없어요.");return}
      draft.pieces.splice(removeIndex,1);draft.count=draft.pieces.length;refreshKinds(draft);recalcTask(draft);renderEditTask(task);toast("예정 Step을 하나 줄였어요.");
    }
