import {runInAction, set} from 'mobx';
import {objKeys} from '../utils';
import {
    BaseFilterConfig,
    FieldFilterConfigs,
    FieldKinds,
    FieldFilters,
    FilterKind,
    ESRequest,
    ESResponse,
    PartialFieldFilterConfigs,
    FieldFilterSubscribers,
    ESMappingType,
    ShouldUseFieldFn
} from '../types';

/**
 * A record tracking whether the unfiltered state (baseline state) for a fields filter has been fetched from the DB
 */
type FieldUnfilteredStateFetched<Fields extends string> = Record<Fields, boolean>;

class BaseFilter<Fields extends string, Config extends BaseFilterConfig, Filter extends object> {
    public fieldConfigDefault: Omit<Required<BaseFilterConfig>, 'field'>;
    public fieldConfigs: FieldFilterConfigs<Fields, Config>;
    public fieldKinds: FieldKinds<Fields>;
    public fieldFilters: FieldFilters<Fields, Filter>;
    public _fieldsThatHaveUnfilteredStateFetched: FieldUnfilteredStateFetched<Fields>;
    public _shouldUpdateUnfilteredAggsSubscribers: Array<FieldFilterSubscribers<Fields>>;
    public _shouldUpdateFilteredAggsSubscribers: Array<FieldFilterSubscribers<Fields>>;
    public filterKind: string;
    public _shouldUseField: ShouldUseFieldFn;

    constructor(
        filterKind: string,
        defaultConfig: Omit<Required<BaseFilterConfig>, 'field'>,
        specificConfigs?: PartialFieldFilterConfigs<Fields, Config>
    ) {
        runInAction(() => {
            this.filterKind = filterKind;
            this.fieldConfigDefault = defaultConfig;
            this.fieldFilters = {} as FieldFilters<Fields, Filter>;
            this.fieldKinds = {} as FieldKinds<Fields>;
            this.fieldConfigs = {} as FieldFilterConfigs<Fields, Config>;
            this._shouldUseField = (_fieldName: string, _fieldType: ESMappingType) => {
                throw new Error(
                    '_shouldUseField is not implemented. The extending class should set the _shouldUseField attribute'
                );
            };

            this._shouldUpdateUnfilteredAggsSubscribers = [];
            this._shouldUpdateFilteredAggsSubscribers = [];
            this._fieldsThatHaveUnfilteredStateFetched = {} as FieldUnfilteredStateFetched<Fields>;
        });

        if (specificConfigs) {
            this._setConfigs(specificConfigs);
        }

        this._subscribeToShouldUpdateUnfilteredAggs = this._subscribeToShouldUpdateUnfilteredAggs.bind(
            this
        );
        this._subscribeToShouldUpdateFilteredAggs = this._subscribeToShouldUpdateFilteredAggs.bind(
            this
        );
        this._findConfigForField = this._findConfigForField.bind(this);
        this._addConfigForField = this._addConfigForField.bind(this);
        this.setAggsEnabledToTrue = this.setAggsEnabledToTrue.bind(this);
        this.setAggsEnabledToFalse = this.setAggsEnabledToFalse.bind(this);
        this._setConfigs = this._setConfigs.bind(this);
        this.setFilter = this.setFilter.bind(this);
        this.clearFilter = this.clearFilter.bind(this);
        this.setKind = this.setKind.bind(this);
        this.kindForField = this.kindForField.bind(this);
    }

    public get _fields(): Fields[] {
        return objKeys(this.fieldConfigs);
    }

    public get fields(): Fields[] {
        throw new Error('fields is not defined');
    }

    public get _activeFields(): Fields[] {
        return objKeys(this.fieldFilters);
    }

    public get activeFields(): Fields[] {
        throw new Error('activeFields is not defined');
    }

    public userState(): {
        fieldKinds?: FieldKinds<Fields>;
        fieldFilters?: FieldFilters<Fields, Filter>;
    } | void {
        const kinds = Object.keys(this.fieldFilters).reduce((fieldKinds, fieldName) => {
            return {
                ...fieldKinds,
                [fieldName]: this.kindForField(fieldName as Fields)
            };
        }, {} as FieldKinds<Fields>);

        if (Object.keys(kinds).length > 0 && Object.keys(this.fieldFilters).length > 0) {
            return {
                fieldKinds: kinds,
                fieldFilters: this.fieldFilters
            };
        } else if (Object.keys(kinds).length > 0) {
            return {
                fieldKinds: kinds
            };
        } else if (Object.keys(this.fieldFilters).length > 0) {
            return {
                fieldFilters: this.fieldFilters
            };
        } else {
            return;
        }
    }

    public rehydrateFromUserState(userState: {
        fieldKinds?: FieldKinds<Fields>;
        fieldFilters?: FieldFilters<Fields, Filter>;
    }) {
        try {
            runInAction(() => {
                this.fieldKinds = userState.fieldKinds || ({} as FieldKinds<Fields>);
                this.fieldFilters = userState.fieldFilters || ({} as FieldFilters<Fields, Filter>);
            });
        } catch (e) {
            throw new Error(`Failed to rehydrate from user state`);
        }
    }

    public clearAllFieldFilters() {
        throw new Error('clearAllFieldFilters is not defined');
    }

    /**
     * Subscribe to actions that should update a single fields unfiltered aggs state
     */
    public _subscribeToShouldUpdateUnfilteredAggs(subscriber: FieldFilterSubscribers<Fields>) {
        runInAction(() => {
            this._shouldUpdateUnfilteredAggsSubscribers.push(subscriber);
        });
    }

    /**
     * Subscribe to actions that should update a single fields filtered aggs state
     */
    public _subscribeToShouldUpdateFilteredAggs(subscriber: FieldFilterSubscribers<Fields>) {
        runInAction(() => {
            this._shouldUpdateFilteredAggsSubscribers.push(subscriber);
        });
    }

    /**
     * State that should cause a global ES query request using all filters
     *
     * Changes to this state is tracked by the manager so that it knows when to run a new filter query
     */
    public get _shouldRunFilteredQueryAndAggs(): object {
        throw new Error('_shouldRunFilteredQueryAndAggs is not defined');
    }

    /**
     * Transforms the request obj.
     *
     * Adds aggs to the request, but no query.
     */
    public _addUnfilteredQueryAndAggsToRequest(_request: ESRequest): ESRequest {
        throw new Error('_addUnfilteredQueryAndAggsToRequest is not defined');
    }

    /**
     * Transforms the request obj.
     *
     * Adds aggs to the request, but no query.
     */
    public _addFilteredAggsToRequest(_request: ESRequest, _fieldToFilterOn: string): ESRequest {
        throw new Error('_addFilteredAggsToRequest is not defined');
    }

    /**
     * Transforms the request obj.
     *
     * Adds aggs to the request, but no query.
     */
    public _addUnfilteredAggsToRequest(_request: ESRequest, _fieldToFilterOn: string): ESRequest {
        throw new Error('_addUnfilteredAggsToRequest is not defined');
    }

    /**
     * Transforms the request obj.
     *
     * Adds query and aggs to the request.
     */
    public _addFilteredQueryAndAggsToRequest(_request: ESRequest): ESRequest {
        throw new Error('_addFilteredQueryAndAggsToRequest is not defined');
    }

    /**
     * Transforms the request obj.
     *
     * Adds query to the request, but no aggs.
     */
    public _addFilteredQueryToRequest(_request: ESRequest): ESRequest {
        throw new Error('_addFilteredQueryToRequest is not defined');
    }

    /**
     * Extracts unfiltered agg stats from a response obj.
     */
    public _extractUnfilteredAggsStateFromResponse(_response: ESResponse): void {
        throw new Error('_extractUnfilteredAggsStateFromResponse is not defined');
    }

    /**
     * Extracts filtered agg stats from a response obj.
     */
    public _extractFilteredAggsStateFromResponse(_response: ESResponse): void {
        throw new Error('_extractFilteredAggsStateFromResponse is not defined');
    }

    /**
     * Returns any config obj that has the same filter name or field name as the passed in field
     */
    public _findConfigForField(field: Fields): Config | undefined {
        const foundFilterName = objKeys(this.fieldConfigs).find(filterName => {
            const config = this.fieldConfigs[filterName];
            return config.field === field || filterName === field;
        });
        if (foundFilterName) {
            return this.fieldConfigs[foundFilterName];
        } else {
            return undefined;
        }
    }
    /**
     * Creates configs for the passed in fields.
     * Uses the default config unless an override config has already been specified.
     */
    public _addConfigForField(field: Fields): void {
        const configAlreadyExists = this._findConfigForField(field);
        if (!configAlreadyExists) {
            runInAction(() => {
                set(this.fieldConfigs, {
                    [field]: {...this.fieldConfigDefault, field}
                });
            });
        }
    }

    /**
     * Updates a fields config such that aggs will be included when a manager asks this
     * filter to add aggs to a request object.
     */
    public setAggsEnabledToTrue(field: Fields): void {
        runInAction(() => {
            set(this.fieldConfigs, {
                [field]: {...this.fieldConfigs[field], aggsEnabled: true}
            });
        });
        if (!this._fieldsThatHaveUnfilteredStateFetched[field]) {
            this._shouldUpdateUnfilteredAggsSubscribers.forEach(s => s(this.filterKind, field));
        }

        this._shouldUpdateFilteredAggsSubscribers.forEach(s => s(this.filterKind, field));
    }

    /**
     * Updates a fields config such that aggs will NOT be included when a manager asks this
     * filter to add aggs to a request object.
     */
    public setAggsEnabledToFalse(field: Fields): void {
        runInAction(() => {
            set(this.fieldConfigs, {
                [field]: {...this.fieldConfigs[field], aggsEnabled: false}
            });
        });
    }

    /**
     * Sets the config for a filter.
     */
    public _setConfigs(fieldConfigs: PartialFieldFilterConfigs<Fields, Config>): void {
        runInAction(() => {
            this.fieldConfigs = objKeys(fieldConfigs).reduce((parsedConfig, field: Fields) => {
                const config = fieldConfigs[field] as Config;

                parsedConfig[field] = {
                    ...this.fieldConfigDefault,
                    ...config
                } as Required<Config>;
                return parsedConfig;
            }, {} as FieldFilterConfigs<Fields, Config>);
        });
    }

    /**
     * Sets a filter for a field.
     */
    public setFilter(field: Fields, filter: Filter): void {
        if (this.fieldConfigs[field] === undefined) {
            throw new Error(
                `${field} filter field doesnt exist. Either add it explicitly (example for range filters: https://github.com/social-native/snpkg-client-elasticsearch#instantiate-a-manager-with-specific-config-options-for-a-range-filter) or run an introspection query (via manager.getFieldNamesAndTypes())`
            );
        }
        runInAction(() => {
            set(this.fieldFilters, {
                [field]: filter
            });
        });
    }

    /**
     * Clears a filter for a field.
     */
    public clearFilter(field: Fields): void {
        runInAction(() => {
            delete this.fieldFilters[field];
        });
    }

    /**
     * Sets the kind for a field. For example, this is how you change a field from 'must' to 'should' and vice versa.
     */
    public setKind(field: Fields, kind: FilterKind): void {
        runInAction(() => {
            this.fieldKinds[field] = kind;
        });
    }

    /**
     * Retrieves the kind of a filter field. Kinds are either specified explicitly on `fieldKinds`
     * or implicitly using the default filter kind.
     */
    public kindForField(field: Fields): FilterKind {
        const kind = this.fieldKinds[field];
        if (kind === undefined) {
            return this.fieldConfigDefault.defaultFilterKind;
        } else {
            return kind as FilterKind;
        }
    }
}

/**
 * Base class, so decorating it isn't necessary. Don't delete b/c this is an easy validation check on the base class.
 * These decorations are copied in to `src/filters/utils#decorateFilter`.
 */
// decorate(BaseFilter, {
//     fields: computed,
//     activeFields: computed,
//     _shouldRunFilteredQueryAndAggs: computed,
//     fieldConfigDefault: observable,
//     fieldConfigs: observable,
//     fieldKinds: observable,
//     fieldFilters: observable,
//     filterKind: observable,
//     _fieldsThatHaveUnfilteredStateFetched: observable,
//     _shouldUpdateUnfilteredAggsSubscribers: observable,
//     _shouldUpdateFilteredAggsSubscribers: observable
// });

export default BaseFilter;
