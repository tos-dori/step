function findTask(taskId){return findTaskInList(taskId,state.tasks)}
    function findTaskInList(taskId,list){taskId=str(taskId);for(var i=0;i<list.length;i++){if(list[i].id===taskId)return list[i]}return null}
    function activeTask(){return findTask(state.activeId)}
    function storedTasks(){return state.tasks.filter(function(task){return task.id!==state.activeId&&!task.doneShelf})}
    function doneShelfTasks(){return state.tasks.map(function(task,index){return{task:task,index:index}}).filter(function(item){return item.task.id!==state.activeId&&!!item.task.doneShelf}).sort(function(a,b){var at=validTimestamp(a.task.doneShelfAt),bt=validTimestamp(b.task.doneShelfAt);if(at&&bt)return bt-at;if(at)return-1;if(bt)return 1;return a.index-b.index}).map(function(item){return item.task})}
    function firstPendingIndex(pieces){for(var i=0;i<pieces.length;i++){if(pieces[i].status===STATUS.PENDING)return i}return pieces.length}
    function findLastPendingIndex(task){for(var i=task.pieces.length-1;i>=0;i--){if(task.pieces[i].status===STATUS.PENDING)return i}return-1}
    function taskHasStarted(task){
      if(!task||!Array.isArray(task.pieces))return false;
      return task.pieces.some(function(piece){return piece.status!==STATUS.PENDING||(Array.isArray(piece.done)&&piece.done.some(Boolean))});
    }
    function canEditPrep(task){return !taskHasStarted(task)}
    function isTaskDone(task){return!!task&&task.pieces.length>0&&firstPendingIndex(task.pieces)>=task.pieces.length}
    function recalcTask(task){task.now=firstPendingIndex(task.pieces);task.count=task.pieces.length;task.view=task.pieces.length?(task.now<task.pieces.length?task.now:task.pieces.length-1):0}
    function viewPiece(task){if(!task||!task.pieces.length)return null;return task.pieces[clamp(task.view,0,task.pieces.length-1)]||null}
    function typeName(type){return TYPE_NAMES[clamp(type,TYPE.STUDY,TYPE.ETC)]||TYPE_NAMES[0]}
