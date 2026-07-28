window.StepSyncApp={
      key:function(){return KEY},
      getCloudState:function(){return stateForCloud()},
      hasLocalCloudData:function(){var data=stateForCloud();return !!(data.activeId||(Array.isArray(data.tasks)&&data.tasks.length))},
      applyCloudState:function(remote){applyCloudState(remote);renderAll()},
      isLocalInputActive:isLocalInputActive,
      isLocalStateSafe:function(){return !window.StepDataSafety||window.StepDataSafety.isSafe()},
      localSafetyIssue:function(){return window.StepDataSafety?window.StepDataSafety.issue():""},
      snapshotLocal:function(reason){return window.StepDataSafety?window.StepDataSafety.snapshotCurrent(reason):false},
      consumeOperation:function(){return window.StepDataSafety?window.StepDataSafety.consumeOperation():""},
      destructiveChange:function(previous,next){return window.StepDataSafety?window.StepDataSafety.destructiveChange(previous,next):false},
      renderAll:renderAll,
      toast:toast
    };
