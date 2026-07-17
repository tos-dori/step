function typeBadge(task){return'<span class="type-pill">'+typeName(task.type)+'</span>'}
    function text(value){return{text:str(value),strong:false}}
    function strong(value){return{text:str(value),strong:true}}
    function line(){return Array.prototype.slice.call(arguments).map(function(part){return typeof part==="string"?text(part):part}).filter(function(part){return part&&clean(part.text)})}

    function getStepChecklist(task,pieceIndex){
      var piece=task&&task.pieces?task.pieces[pieceIndex]:null;
      if(!piece)return[];
      var finish=clean(task.finishText),isFirst=pieceIndex===0,isLast=pieceIndex===task.pieces.length-1,isOnly=task.pieces.length===1;
      var items=[];
      if(shouldShowPrepCheck(task,pieceIndex))items.push(checkItem(0,prepCheckLine(task),true));
      var main;
      if(piece.kind===KIND.BLOCKED)main=blockedChecklist(task);
      else if(piece.kind===KIND.INCOMPLETE)main=incompleteChecklist(task,isLast);
      else if(isOnly)main=onlyChecklist(task,finish);
      else if(isLast)main=lastChecklist(task,finish);
      else if(isFirst)main=firstChecklist(task);
      else main=middleChecklist(task);
      main.forEach(function(parts,index){items.push(checkItem(index+1,parts,false))});
      return items;
    }
    function checkItem(number,parts,muted){return{number:number,parts:parts,muted:!!muted}}
    function shouldShowPrepCheck(task,pieceIndex){return!!task&&!!task.prep&&pieceIndex===0}
    function prepCheckLine(task){
      if(task.type===TYPE.ASSIGNMENT)return line("과제 파일 열기");
      if(task.type===TYPE.ETC)return line("필요한 것 꺼내기");
      return line("자료 열기");
    }
    function firstChecklist(task){
      if(task.type===TYPE.ASSIGNMENT)return[line("시작할 부분 열기"),line("20분 제출물 만들기"),line("진행상황·다음 손댈 곳 잡기")];
      if(task.type===TYPE.ETC)return[line("할 위치 확인하기"),line("20분 실제로 하기"),line("남은 것·다음 동작 잡기")];
      return[line("시작할 곳 열기"),line("20분 읽고 풀기"),line("핵심·막힌 점·다음 볼 곳 잡기")];
    }
    function middleChecklist(task){
      if(task.type===TYPE.ASSIGNMENT)return[line("이어갈 부분 열기"),line("20분 제출물 만들기"),line("진행상황·다음 손댈 곳 잡기")];
      if(task.type===TYPE.ETC)return[line("이어갈 위치 확인하기"),line("20분 실제로 하기"),line("남은 것·다음 동작 잡기")];
      return[line("이어갈 곳 열기"),line("20분 읽고 풀기"),line("핵심·막힌 점·다음 볼 곳 잡기")];
    }
    function lastChecklist(task,finish){
      if(task.type===TYPE.ASSIGNMENT)return[line("남은 부분 열기"),finish?line(strong(finish),"까지 마무리하기"):line("20분 제출물 마무리하기"),line("진행상황·빠진 것 확인하기")];
      if(task.type===TYPE.ETC)return[line("남은 것 확인하기"),finish?line(strong(finish),"까지 마무리하기"):line("20분 실제로 마무리하기"),line("다음 동작 정하기")];
      return[line("남은 부분 열기"),finish?line(strong(finish),"까지 마무리하기"):line("20분 읽고 풀기"),line("핵심·막힌 점 잡기")];
    }
    function onlyChecklist(task,finish){
      if(task.type===TYPE.ASSIGNMENT){
        if(hasSubmitCue(finish))return[line("제출 조건 열기"),line("20분 제출물 마무리하기"),line("진행상황·빠진 것 확인하기")];
        return[line("시작할 부분 열기"),line("20분 제출물 만들기"),line("진행상황·다음 손댈 곳 잡기")];
      }
      if(task.type===TYPE.ETC)return[line("할 위치 확인하기"),line("20분 실제로 하기"),line("남은 것·다음 동작 잡기")];
      return[line("시작할 곳 열기"),line("20분 읽고 풀기"),line("핵심·막힌 점·다음 볼 곳 잡기")];
    }
    function incompleteChecklist(task,isLast){
      if(task.type===TYPE.ASSIGNMENT)return[line("못 끝낸 지점 열기"),line("20분 이어서 만들기"),isLast?line("진행상황·빠진 것 확인하기"):line("남은 부분·다음 손댈 곳 잡기")];
      if(task.type===TYPE.ETC)return[line("못 끝낸 지점 보기"),line("20분 이어서 하기"),line("남은 것·다음 동작 잡기")];
      return[line("못 끝낸 지점 열기"),line("20분 이어서 보기"),line("막힌 점·다음 볼 곳 잡기")];
    }
    function blockedChecklist(task){
      if(task.type===TYPE.ASSIGNMENT)return[line("막힌 지점 열기"),line("가능한 부분만 건드리기"),line("막힌 이유·다음 확인거리 잡기")];
      if(task.type===TYPE.ETC)return[line("막힌 지점 보기"),line("가능한 것만 하기"),line("막힌 이유·다음 동작 잡기")];
      return[line("막힌 부분 열기"),line("예제나 설명 하나 보기"),line("막힌 이유·다음 볼 곳 잡기")];
    }
    function hasSubmitCue(text){return/(제출|업로드|마감|완료)/.test(clean(text))}
    function kindForNewPiece(task,index,total){if(index===0)return KIND.START;if(index===total-1&&task.type===TYPE.ASSIGNMENT&&total>1)return KIND.SUBMIT;if(index===total-1&&total>2)return KIND.WRAP;return KIND.CONTINUE}
    function refreshKinds(task){for(var i=0;i<task.pieces.length;i++){if(task.pieces[i].kind!==KIND.INCOMPLETE&&task.pieces[i].kind!==KIND.BLOCKED)task.pieces[i].kind=kindForNewPiece(task,i,task.pieces.length)}}
    function makePieces(task){var pieces=[],total=clamp(task.count,1,6);for(var i=0;i<total;i++)pieces.push(newPiece(kindForNewPiece(task,i,total)));return pieces}
    function newPiece(kind){return{status:STATUS.PENDING,kind:kind||KIND.CONTINUE,done:[false,false,false]}}
