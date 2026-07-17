var el={
      subtitle:byId("subtitle"),doView:byId("doView"),addView:byId("addView"),topBtn:byId("topBtn"),clearDraftBtn:byId("clearDraftBtn"),
      taskInput:byId("taskInput"),startInput:byId("startInput"),memoInput:byId("memoInput"),memoHelp:byId("memoHelp"),finishInput:byId("finishInput"),prepInput:byId("prepInput"),addBtn:byId("addBtn"),addSettingsToggle:byId("addSettingsToggle"),addSettingsState:byId("addSettingsState"),addSettingsCard:byId("addSettingsCard"),
      currentCard:byId("currentCard"),listCard:byId("listCard"),toast:byId("toast"),celebration:byId("celebration")
    };

    function byId(id){return document.getElementById(id)}
    function all(selector,root){return Array.prototype.slice.call((root||document).querySelectorAll(selector))}
