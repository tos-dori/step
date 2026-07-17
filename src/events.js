function bindHold(selector,onComplete,root){
      var button=(root||document).querySelector(selector);if(!button||button.disabled)return;
      var timer=null,raf=null,startTime=0,completed=false;
      function reset(){button.classList.remove("holding");button.style.setProperty("--hold",0)}
      function cleanup(){if(timer)clearTimeout(timer);if(raf)cancelAnimationFrame(raf);timer=null;raf=null;completed=false;reset()}
      function tick(){var ratio=Math.min((performance.now()-startTime)/HOLD_MS,1);button.style.setProperty("--hold",ratio);if(ratio<1&&!completed)raf=requestAnimationFrame(tick)}
      function start(event){if(button.disabled)return;event.preventDefault();cleanup();startTime=performance.now();button.classList.add("holding");raf=requestAnimationFrame(tick);timer=setTimeout(function(){if(completed)return;completed=true;button.style.setProperty("--hold",1);onComplete();cleanup()},HOLD_MS)}
      function cancel(event){if(event)event.preventDefault();cleanup()}
      button.addEventListener("pointerdown",start);
      button.addEventListener("pointerup",cancel);
      button.addEventListener("pointerleave",cancel);
      button.addEventListener("pointercancel",cancel);
      button.addEventListener("contextmenu",function(event){event.preventDefault()});
      button.addEventListener("keydown",function(event){if(event.key!==" "&&event.key!=="Enter")return;if(event.repeat)return;start(event)});
      button.addEventListener("keyup",function(event){if(event.key!==" "&&event.key!=="Enter")return;cancel(event)});
    }
    function focusTaskInput(){setTimeout(function(){el.taskInput.focus()},0)}
    function bindInput(input,key,after){input.addEventListener("input",function(){armedDraftClear=false;state[key]=input.value;if(input.tagName==="TEXTAREA")autoGrow(input);if(after)after();saveState();renderAddControls()})}
    function bindStaticEvents(){
      bindInput(el.taskInput,"draft",updateAddButton);
      bindInput(el.startInput,"startText");
      bindInput(el.memoInput,"memoText");
      bindInput(el.finishInput,"finishText");
      bindInsertButton(byId("memoInsertBtn"),el.memoInput,function(){return function(value){armedDraftClear=false;state.memoText=value;saveState();renderAddControls()}});
      if(el.addSettingsToggle)el.addSettingsToggle.onclick=function(){armedDraftClear=false;state.addSettingsOpen=!state.addSettingsOpen;saveState();renderAddControls()};
      el.prepInput.addEventListener("change",function(){armedDraftClear=false;state.prep=el.prepInput.checked;saveState();renderAddControls()});
      el.addBtn.onclick=addTask;
      if(el.clearDraftBtn)el.clearDraftBtn.onclick=function(){clearAddDraftFromButton()};
      all("[data-type]").forEach(function(btn){btn.onclick=function(){armedDraftClear=false;state.type=Number(btn.dataset.type);saveState();renderAddControls()}});
      all("[data-count]").forEach(function(btn){btn.onclick=function(){armedDraftClear=false;state.count=Number(btn.dataset.count);saveState();renderAddControls()}});
      el.topBtn.onclick=function(){armedDeleteId=null;armedDraftClear=false;if(state.screen==="add"){state.screen="do";saveState();renderAll();return}openAddView()};
    }
