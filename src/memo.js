function memoGuide(type){
      type=clamp(type,TYPE.STUDY,TYPE.ETC);
      if(type===TYPE.ASSIGNMENT)return{line1:"제출 기한 / 이어갈 곳",line2:"조건 · 채점 기준 · 참고자료",placeholder:"예: 금 23:59 / 3번 풀이 중간부터"};
      if(type===TYPE.ETC)return{line1:"시간·장소 / 이어갈 곳",line2:"준비물 · 주의할 점",placeholder:"예: 6시 학교 앞 / 챙길 것"};
      return{line1:"이어갈 곳 / 이번 목표",line2:"헷갈린 점 · 예제 · 참고자료",placeholder:"예: p.37 예제 4부터 / 헷갈린 개념"};
    }
    function renderMemoHelp(type){var guide=memoGuide(type);return'<span>'+safe(guide.line1)+'</span><span>'+safe(guide.line2)+'</span>'}
    function applyMemoGuide(){var guide=memoGuide(state.type);if(el.memoHelp)el.memoHelp.innerHTML=renderMemoHelp(state.type);if(el.memoInput)el.memoInput.placeholder=guide.placeholder}
    function isMemoTokenLabel(ch){return /^[A-Za-z0-9]$/.test(ch||"")}
    function circledMemoLabel(label){
      var ch=str(label).charAt(0);
      if(/^[a-z]$/.test(ch))return String.fromCharCode(0x24D0+ch.charCodeAt(0)-97);
      if(/^[A-Z]$/.test(ch))return String.fromCharCode(0x24B6+ch.charCodeAt(0)-65);
      if(ch==="0")return "⓪";
      if(/^[1-9]$/.test(ch))return String.fromCharCode(0x2460+Number(ch)-1);
      return ch;
    }
    function memoTokenHtml(mark,label,index,interactive){
      var checked=mark==="●",hasLabel=!!label;
      var symbol=hasLabel?circledMemoLabel(label):(checked?"●":"○");
      var labelKind=hasLabel?(/^[0-9]$/.test(label)?" digit":" letter"):"";
      var cls="memo-token "+(hasLabel?"labeled":"empty")+labelKind+(checked?" checked":"")+(interactive?"":" preview-token");
      if(!interactive)return '<span class="'+cls+'">'+safe(symbol)+'</span>';
      var aria=(checked?"완료된 메모 체크":"메모 체크")+(hasLabel?" "+label:"");
      return '<span class="'+cls+'" role="button" tabindex="0" aria-label="'+attr(aria)+'" data-memo-token="'+index+'">'+safe(symbol)+'</span>';
    }
    function renderMemoTokens(value,interactive){
      var input=str(value),out="",i=0;
      while(i<input.length){
        var ch=input.charAt(i);
        if(ch==="○"||ch==="●"){
          var label=isMemoTokenLabel(input.charAt(i+1))?input.charAt(i+1):"";
          out+=memoTokenHtml(ch,label,i,interactive);
          i+=label?2:1;
        }else{
          var start=i;
          while(i<input.length&&input.charAt(i)!=="○"&&input.charAt(i)!=="●")i++;
          out+=safe(input.slice(start,i));
        }
      }
      return out;
    }
    function renderMemoText(value){return renderMemoTokens(value,true)}
    function renderMemoPreviewText(value){return renderMemoTokens(value,false)}
    function insertMemoToken(input,afterInsert){
      if(!input)return;
      var scrollTop=input.scrollTop||0,start=typeof input.selectionStart==="number"?input.selectionStart:input.value.length,end=typeof input.selectionEnd==="number"?input.selectionEnd:start;
      var before=input.value.slice(0,start),after=input.value.slice(end);
      input.value=before+"○"+after;
      var pos=start+1;
      input.focus({preventScroll:true});
      input.setSelectionRange(pos,pos);
      input.scrollTop=scrollTop;
      if(afterInsert)afterInsert(input.value);
      autoGrow(input);
    }
    function bindInsertButton(button,input,getSetter){
      if(!button||!input)return;
      function run(event){event.preventDefault();var setValue=getSetter&&getSetter();insertMemoToken(input,setValue)}
      button.addEventListener("pointerdown",run);
      button.addEventListener("click",function(event){event.preventDefault()});
    }
    function toggleMemoToken(task,index){
      if(!task)return;index=Number(index);var memo=str(task.memoText);if(index<0||index>=memo.length)return;
      var mark=memo.charAt(index);if(mark!=="○"&&mark!=="●")return;
      var box=el.currentCard?el.currentCard.querySelector(".memo-content"):null,scrollTop=box?box.scrollTop:0;
      task.memoText=memo.slice(0,index)+(mark==="○"?"●":"○")+memo.slice(index+1);
      saveState();renderCurrent();
      requestAnimationFrame(function(){var next=el.currentCard?el.currentCard.querySelector(".memo-content"):null;if(next)next.scrollTop=scrollTop});
    }
    function bindMemoTokens(task){
      all("[data-memo-token]",el.currentCard).forEach(function(token){
        token.onclick=function(event){event.stopPropagation();toggleMemoToken(task,token.dataset.memoToken)};
        token.onkeydown=function(event){if(event.key!=="Enter"&&event.key!==" ")return;event.preventDefault();toggleMemoToken(task,token.dataset.memoToken)};
      });
    }
