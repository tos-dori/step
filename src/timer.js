function resetTimer(mode){state.timer={mode:mode||TIMER.FOCUS,running:false,startedAt:null,elapsed:0}}
    function timerDuration(){return TIMER_MS[state.timer.mode]||0}
    function timerElapsed(){
      if(state.timer.mode===TIMER.OFF)return 0;
      var elapsed=Number(state.timer.elapsed||0);
      if(state.timer.running&&state.timer.startedAt)elapsed+=Date.now()-Number(state.timer.startedAt);
      return Math.max(0,elapsed);
    }
    function timerView(){
      var mode=state.timer.mode||TIMER.FOCUS;
      if(mode===TIMER.OFF)return{mode:mode,display:"",offset:CIRCLE_LEN,over:false,running:false};
      var duration=timerDuration(),elapsed=timerElapsed(),over=elapsed>duration;
      var seconds=over?Math.floor((elapsed-duration)/1000):Math.ceil(Math.max(duration-elapsed,0)/1000);
      var remainingRatio=over?0:Math.max(duration-elapsed,0)/duration;
      return{mode:mode,display:formatSeconds(seconds),offset:CIRCLE_LEN*(1-remainingRatio),over:over,running:!!state.timer.running};
    }
    function formatSeconds(totalSeconds){
      totalSeconds=Math.max(0,Math.floor(totalSeconds));
      var minutes=Math.floor(totalSeconds/60),seconds=totalSeconds%60;
      return pad2(minutes)+":"+pad2(seconds);
    }
    function pad2(value){return value<10?"0"+value:String(value)}
    function flashTimer(){
      var card=byId("timerCard");if(!card)return;
      if(timerFlashTimer)clearTimeout(timerFlashTimer);
      card.classList.remove("tap-flash");void card.offsetWidth;card.classList.add("tap-flash");
      timerFlashTimer=setTimeout(function(){card.classList.remove("tap-flash")},180);
    }
    function toggleTimer(){
      if(state.timer.mode===TIMER.OFF)return;
      if(state.timer.running){
        state.timer.elapsed=timerElapsed();
        state.timer.running=false;
        state.timer.startedAt=null;
      }else{
        state.timer.running=true;
        state.timer.startedAt=Date.now();
      }
      saveState();
      updateTimerDom();
      flashTimer();
    }
    function cycleTimerMode(){
      var next=state.timer.mode===TIMER.FOCUS?TIMER.BREAK:state.timer.mode===TIMER.BREAK?TIMER.OFF:TIMER.FOCUS;
      resetTimer(next);
      saveState();
      updateTimerDom();
    }
    function renderTimer(){
      var view=timerView();
      var cls="timer-card "+(view.mode===TIMER.BREAK?"break-mode":view.mode===TIMER.OFF?"off":"focus-mode")+(view.over?" over":"")+(view.running?"":" paused");
      return '<div class="timer-wrap"><button class="'+cls+'" id="timerCard" style="--timer-offset:'+view.offset+'" aria-label="Step 타이머"><svg class="timer-svg" viewBox="0 0 60 60" aria-hidden="true"><circle class="timer-track" cx="30" cy="30" r="24"></circle><circle class="timer-progress" cx="30" cy="30" r="24"></circle></svg><span class="timer-text">'+safe(view.display)+'</span></button></div>';
    }
    function updateTimerDom(){
      var card=byId("timerCard");
      if(!card)return;
      var view=timerView();
      card.className="timer-card "+(view.mode===TIMER.BREAK?"break-mode":view.mode===TIMER.OFF?"off":"focus-mode")+(view.over?" over":"")+(view.running?"":" paused");
      card.style.setProperty("--timer-offset",view.offset);
      var textNode=card.querySelector(".timer-text");
      if(textNode)textNode.textContent=view.display;
    }
    function bindTimer(){
      var card=byId("timerCard");
      if(!card)return;
      var timer=null,longDone=false;
      function cleanup(){if(timer)clearTimeout(timer);timer=null;card.classList.remove("holding")}
      function start(event){
        event.preventDefault();
        cleanup();
        longDone=false;
        card.classList.add("holding");
        timer=setTimeout(function(){longDone=true;cycleTimerMode();cleanup()},TIMER_HOLD_MS);
      }
      function end(event){
        if(event)event.preventDefault();
        if(!longDone)toggleTimer();
        cleanup();
      }
      function cancel(event){if(event)event.preventDefault();cleanup()}
      card.addEventListener("pointerdown",start);
      card.addEventListener("pointerup",end);
      card.addEventListener("pointerleave",cancel);
      card.addEventListener("pointercancel",cancel);
      card.addEventListener("contextmenu",function(event){event.preventDefault()});
    }
    function startTimerLoop(){
      if(timerTick)clearInterval(timerTick);
      if(timePlanTick)clearInterval(timePlanTick);
      timerTick=setInterval(function(){
        if(state.timer&&state.timer.running)updateTimerDom();
      },500);
      timePlanTick=setInterval(updateTimePlanDom,30000);
    }
