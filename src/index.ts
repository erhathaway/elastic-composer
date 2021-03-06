import {configure} from 'mobx';

export {default as Manager} from './manager';
export {default as MappingParser} from './mapping_parser';
export {default as History} from './history';
export {default as Sort} from './sort';

export * from './history';
export * from './types';
export * from './filters';
export * from './clients';
export * from './suggestions';

configure({
    computedRequiresReaction: true,
    reactionRequiresObservable: true,
    enforceActions: 'always',
    isolateGlobalState: false
});
