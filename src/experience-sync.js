/* Complete the v0.6.60 experience adapter with an atomic group-aware remote apply.
   The older applyCloudState does not carry groups; replacing it here avoids
   writing an intermediate, group-less snapshot to the canonical local key. */
applyCloudState=function(remote,reason){
  const previous=state;
  const local=currentLocalUiState();
  const next=baseState();
  remote=remote||{};
  next.screen=local.screen;
  next.draft=local.draft;
  next.startText=local.startText;
  next.memoText=local.memoText;
  next.finishText=local.finishText;
  next.type=local.type;
  next.count=local.count;
  next.prep=local.prep;
  next.addSettingsOpen=local.addSettingsOpen;
  next.libraryOpen=local.libraryOpen;
  next.doneShelfOpen=local.doneShelfOpen;
  next.selectedLibraryId=local.selectedLibraryId;
  next.timer=local.timer;
  next.groupOpen=state&&state.groupOpen?{...state.groupOpen}:{};
  next.groups=sxGroups(remote.groups);
  next.activeId=remote.activeId?String(remote.activeId):null;
  next.tasks=Array.isArray(remote.tasks)?remote.tasks.map(normalizeTask).filter(Boolean):[];
  state=normalizeState(next);
  if(saveLocalState(reason||'remote-apply')===false){
    state=previous;
    return false;
  }
  return true;
};
