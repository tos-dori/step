window.StepSyncApp={
      key:function(){return KEY},
      getCloudState:function(){return stateForCloud()},
      hasLocalCloudData:function(){var data=stateForCloud();return !!(data.activeId||(Array.isArray(data.tasks)&&data.tasks.length))},
      applyCloudState:function(remote,reason){applyCloudState(remote,reason);renderAll()},
      isLocalInputActive:isLocalInputActive,
      isLocalStateSafe:function(){return !window.StepDataSafety||window.StepDataSafety.isSafe()},
      localSafetyIssue:function(){return window.StepDataSafety?window.StepDataSafety.issue():""},
      checkpointLocal:function(reason,force){return window.StepDataSafety?window.StepDataSafety.checkpointCurrent(reason,force):false},
      listLocalCheckpoints:function(){return window.StepDataSafety?window.StepDataSafety.listCheckpoints():[]},
      restoreLocalCheckpoint:function(slot){return window.StepDataSafety?window.StepDataSafety.restoreLocal(slot):null},
      cloudStateSafe:function(value){return !window.StepDataSafety||window.StepDataSafety.cloudStateSafe(value)},
      cloudStateSize:function(value){return window.StepDataSafety?window.StepDataSafety.cloudSize(value):0},
      nonEmptyToEmpty:function(previous,next){return window.StepDataSafety?window.StepDataSafety.nonEmptyToEmpty(previous,next):false},
      renderAll:renderAll,
      toast:toast
    };
