window.StepSyncApp={
      key:function(){return KEY},
      getCloudState:function(){return stateForCloud()},
      hasLocalCloudData:function(){var data=stateForCloud();return !!(data.activeId||(Array.isArray(data.tasks)&&data.tasks.length))},
      applyCloudState:function(remote){applyCloudState(remote);renderAll()},
      isLocalInputActive:isLocalInputActive,
      renderAll:renderAll,
      toast:toast
    };
