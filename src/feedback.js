function toast(message){if(toastTimer)clearTimeout(toastTimer);el.toast.textContent=message;el.toast.classList.add("show");toastTimer=setTimeout(function(){el.toast.classList.remove("show")},1300)}
    function showCelebration(){if(celebrationTimer)clearTimeout(celebrationTimer);el.celebration.classList.remove("show");void el.celebration.offsetWidth;el.celebration.classList.add("show");celebrationTimer=setTimeout(function(){el.celebration.classList.remove("show")},1250)}
    function autoGrow(node){
      if(!node)return;
      node.style.height="auto";
      var wanted=Math.max(node.scrollHeight,MEMO_LINE*MEMO_MIN_LINES);
      if(wanted<=MEMO_MAX_HEIGHT+MEMO_TOLERANCE){
        node.style.height=wanted+"px";
        node.style.overflowY="hidden";
      }else{
        node.style.height=MEMO_MAX_HEIGHT+"px";
        node.style.overflowY="auto";
      }
    }
    function autoGrowAll(){all("textarea.memo-field").forEach(autoGrow)}
