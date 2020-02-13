# snpkg-client-elasticsearch

-   [snpkg-client-elasticsearch](#snpkg-client-elasticsearch)
    -   [Install](#install)
    -   [Peer dependencies](#peer-dependencies)
    -   [About](#about)
    -   [Quick Examples](#quick-examples)
        -   [Instantiate a manager with a range filter](#instantiate-a-manager-with-a-range-filter)
        -   [Specify config options for a range filter](#specify-config-options-for-a-range-filter)
        -   [Get the initial results for a manager](#get-the-initial-results-for-a-manager)
        -   [Setting a range filter](#setting-a-range-filter)
        -   [Setting a boolean filter](#setting-a-boolean-filter)
        -   [Access the results of a query](#access-the-results-of-a-query)
        -   [Paginating through the results set](#paginating-through-the-results-set)
    -   [API](#api)
        -   [Manager](#manager)
            -   [Initialization](#initialization)
                -   [Client](#client)
                -   [Filters](#filters)
                -   [Options](#options)
            -   [Methods](#methods)
            -   [Attributes](#attributes)
        -   [Common Among All Filters](#common-among-all-filters)
            -   [Initialization](#initialization-1)
            -   [Methods](#methods-1)
            -   [Attributes](#attributes-1)
        -   [Boolean Specific](#boolean-specific)
            -   [Initialization](#initialization-2)
                -   [defaultConfig](#defaultconfig)
                -   [specificConfig](#specificconfig)
            -   [Methods](#methods-2)
            -   [Attributes](#attributes-2)
        -   [Range Specific](#range-specific)
            -   [Initialization](#initialization-3)
                -   [defaultConfig](#defaultconfig-1)
                -   [specificConfig](#specificconfig-1)
            -   [Methods](#methods-3)
            -   [Attributes](#attributes-3)
    -   [Verbose Examples](#verbose-examples)
        -   [Set the context](#set-the-context)
        -   [Use a filter in a pure component](#use-a-filter-in-a-pure-component)

## Install

```
npm install --save @social-native/snpkg-client-elasticsearch
```

## Peer dependencies

This package requires that you also install:

```typescript
{
        "await-timeout": "^1.1.1",
        "axios": "^0.19.1", <------- only used if using the AxiosESClient
        "lodash.chunk": "^4.2.0",
        "mobx": "^5.14.2"
}
```

## About

This package aids in querying an Elasticsearch index. You define `filter` for each field in the index that you want to query, and the specific filter API allows you to generate a valid query across many fields. Additionally, you can define `suggestions` for `text` and `keyword` fields to aid in suggesting possible `filters` to apply for that field.

The currently available filters are:

-   `range`: Filter records by specifying a LT (<), LTE(<=), GT(>), GTE(>=) range
-   `boolean`: Filter records that have a value of either `true` or `false`

The currently available suggestions are:

-   `prefix`: Get suggestions for fields based on matches with the same prefix
-   `fuzzy`: Get suggestions for fields based on [fuzzy matching](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-fuzzy-query.html)

There also exists a `manager` object which is how you access each filter, get the results of a query, and paginate through the result set.

Extending and overriding the set of usable filters or suggestions and overriding is also possible. See [Extending Filters and Suggestions](#extending-filters-and-suggestions)

## Quick Examples

#### Instantiate a manager

```typescript
import {}
// instantiate an elasticsearch axios client made for this lib
const client = new AxiosESClient('my_url/my_index');


// instantiate a manager
const manager = new Manager(
    client,
    {pageSize: 100, queryThrottleInMS: 350, fieldBlackList: ['id']}
);
```

#### Specify config options for a range filter

```typescript
// set the default config all filters will have if not explicitly set
// by default we don't want aggs enabled unless we know the filter is being shown in the UI. So,
// we use lifecycle methods in react to toggle this config attribute and set the default to `false`.
const defaultRangeFilterConfig = {
    aggsEnabled: false,
    defaultFilterKind: 'should',
    getDistribution: true,
    getRangeBounds: true,
    rangeInterval: 1
};

// explicitly set the config for certain fields
const customRangeFilterConfig = {
    age: {
        field: 'user.age',
        rangeInterval: 10
    },
    invites: {
        field: 'user.invites',
        getDistribution: false
    }
};

// instantiate a range filter
const rangeFilter = new RangeFilter(defaultRangeFilterConfig, customRangeFilterConfig);

const options = {
    pageSize: 100,
    queryThrottleInMS: 350,
    fieldBlackList: ['id'],
    filters: {range: rangeFilter}
};

const manager = new Manager<typeof rangeFilter>(
    client,
    options
);
```

#### Get the initial results for a manager

All queries are treated as requests and added to an internal queue. Thus, you don't await this method but, react to the `manager.results` attribute.

```typescript
manager.runStartQuery();
```

#### Setting a range filter

```typescript
manager.filters.range.setFilter('age', {greaterThanEqual: 20, lessThan: 40});
```

> Note: This triggers a query to rurun with all the existing filters plus the range filter for `age` will be updated
> to only include people between the ages of 20-40 (inclusive to exclusive).

#### Setting a boolean filter

```typescript
manager.filters.boolean.setFilter('isActive', {state: true});
```

#### Access the results of a query

```typescript
manager.results; // Array<ESHit>
```

Results are an array where each object in the array has the type:

```typescript
export type ESHit<Source extends object = object> = {
    _index: string;
    _type: string;
    _id: string;
    _score: number;
    _source: Source;
    sort: ESRequestSortField;
};
```

> `_source` will be the document result from the index.

Thus, you would likely use the `results` like:

```typescript
manager.results.map(r => r._source);
```

#### Paginating through the results set

```typescript
manager.nextPage();
manager.prevPage();

manager.currentPage; // number
// # => 0 when no results exist
// # => 1 for the first page of results
```

## API

### Manager

#### Initialization

The manager constructor has the signature `(client, filters, options) => ManagerInstance`

##### Client

`client` is an object than handles submitting query responses. It has the signature:

```typescript
interface IClient<Source extends object = object> {
    search: (request: ESRequest) => Promise<ESResponse<Source>>;
    mapping: () => Promise<Record<string, ESMappingType>>;
    // With ESMappingType equal to https://www.elastic.co/guide/en/elasticsearch/reference/current/mapping-types.html
}
```

At the moment there only exists an `Axios` client. This can be imported via a named import:

```ts
import {Axios} from '@socil-native/snpkg-client-elasticsearch';

const axiosESClient = new Axios(endpoint);

// endpoint is in the form: blah2lalkdjhgak.us-east-1.es.amazonaws.com/myindex1
```

##### Filters

`filters` is an object of filter instances. Ahead of time, you should have instantiated every filter you want to use. You then pass these filter instances to the manager in this object, like so:

```ts
const filters = {range: rangeFilterInstance};
```

##### Options

`options` are used to configure the manager. There currently exist these options:

```ts
type ManagerOptions = {
    pageSize?: number;
    queryThrottleInMS?: number;
    fieldWhiteList?: string[];
    fieldBlackList?: string[];
};
```

-   `pageSize`: the number of results to expect when calling `manager.results`. The default size is 10.
-   `queryThrottleInMS`: the amount of time to wait before executing an Elasticsearch query. The default time is 1000.
-   `fieldWhiteList`: A list of elasticsearch fields that you only want to allow filtering on. This can't be used with `fieldBlackList`
-   `fieldBlackList`: A list of elasticsearch fields that you don't want to allow filtering on. This can't be used with `fieldWhiteList`

#### Methods

| method                | description                                                                                                                             | type       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| nextPage              | paginates forward                                                                                                                       | `(): void` |
| prevPage              | paginates backward                                                                                                                      | `(): void` |
| getFieldNamesAndTypes | runs an introspection query on the index mapping and generates an object of elasticsearch fields and the filter type they correspond to | `(): void` |
| runStartQuery         | runs the initial elasticsearch query that fetches unfiltered data                                                                       | `(): void` |

#### Attributes

| attribute               | description                                                                                                                                   | notes                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| isSideEffectRunning     | a flag telling if a query is running                                                                                                          | `boolean`                                                                           |
| currentPage             | the page number                                                                                                                               | `0` if there are no results. `1` for the first page. etc...                         |
| fieldWhiteList          | the white list of fields that filters can exist for                                                                                           |                                                                                     |
| fieldBlackList          | the black list of fields that filters can not exist for                                                                                       |                                                                                     |
| pageSize                | the page size                                                                                                                                 | The default size is 10. This can be changed by setting manager options during init. |
| queryThrottleInMS       | the throttle time for queries                                                                                                                 | The default is 1000 ms. This can be changed by setting manager options during init. |
| filters                 | the filter instances that the manager controls                                                                                                |
| indexFieldNamesAndTypes | A list of fields that can be filtered over and the filter name that this field uses. This is populated by the method `getFieldNamesAndTypes`. |

### Common Among All Filters

#### Initialization

All filter constructors have the signature `(defaultConfig, specificConfig) => FilterTypeInstance`

`defaultConfig` and `specificConfig` are specific to each filter class type.

#### Methods

| method      | description                   | type                                                                             |
| ----------- | ----------------------------- | -------------------------------------------------------------------------------- |
| setFilter   | sets the filter for a field   | `(field: <name of field>, filter: <filter specific to filter class type>): void` |
| clearFilter | clears the filter for a field | `(field: <name of field>): void`                                                 |
| setKind     | sets the kind for a field     | `(field: <name of field>, kind: should or must): void`                           |

#### Attributes

| attribute    | description                                                  | type                                                              |
| ------------ | ------------------------------------------------------------ | ----------------------------------------------------------------- |
| fieldConfigs | the config for a field, keyed by field name                  | `{ [<names of fields>]: <config specific to filter class type> }` |
| fieldFilters | the filters for a field, keyed by field name                 | `{ [<names of fields>]: Filter }`                                 |
| fieldKinds   | the kind (`should or must`) for a field, keyed by field name | `{ [<names of fields>]: 'should' or 'must' }`                     |

### Boolean Specific

#### Initialization

The boolean constructor has the signature `(defaultConfig, specificConfig) => RangeInstance`

##### defaultConfig

The configuration that each field will acquire if an override is not specifically set in `specificConfig`

```typescript
type DefaultConfig = {
    defaultFilterKind: 'should' | 'must';
    getCount: boolean;
    aggsEnabled: boolean;
};
```

##### specificConfig

The explicit configuration set on a per field level. If a config isn't specified or only partially specified for a field, the defaultConfig will be used to fill in the gaps.

```typescript
type SpecificConfig = Record<string, BooleanConfig>;

type BooleanConfig = {
    field: string;
    defaultFilterKind?: 'should' | 'must';
    getCount?: boolean;
    aggsEnabled?: boolean;
};
```

#### Methods

| method    | description                 | type                                                                    |
| --------- | --------------------------- | ----------------------------------------------------------------------- |
| setFilter | sets the filter for a field | `(field: <name of boolean field>, filter: {state: true | false}): void` |

#### Attributes

| attribute       | description                                                                  | type                                                               |
| --------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| filteredCount   | the count of boolean values of all unfiltered documents, keyed by field name | `{ [<names of boolean fields>]: { true: number; false: number;} }` |
| unfilteredCount | the count of boolean values of all unfiltered documents, keyed by field name | `{ [<names of boolean fields>]: { true: number; false: number;} }` |

### Range Specific

#### Initialization

The range constructor has the signature `(defaultConfig, specificConfig) => RangeInstance`

##### defaultConfig

The configuration that each field will acquire if an override is not specifically set in `specificConfig`

```typescript
type RangeConfig = {
    defaultFilterKind: 'should' | 'must';
    getDistribution: boolean;
    getRangeBounds: boolean;
    rangeInterval: number;
    aggsEnabled: boolean;
};
```

##### specificConfig

The explicit configuration set on a per field level. If a config isn't specified or only partially specified for a field, the defaultConfig will be used to fill in the gaps.

```typescript
type SpecificConfig = Record<string, RangeConfig>;

type RangeConfig = {
    field: string;
    defaultFilterKind?: 'should' | 'must';
    getDistribution?: boolean;
    getRangeBounds?: boolean;
    rangeInterval?: number;
    aggsEnabled?: boolean;
};
```

#### Methods

| method    | description                 | type                                                                                                                                        |
| --------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| setFilter | sets the filter for a field | `(field: <name of range field>, filter: {lessThan?: number, greaterThan?: number, lessThanEqual?: number, greaterThanEqual?: number): void` |

#### Attributes

| attribute              | description                                                            | type                                                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| filteredRangeBounds    | the bounds of all filtered ranges (ex: 20 - 75), keyed by field name   | `{ [<names of range fields>]: { min: { value: number; value_as_string?: string; }; max: { value: number; value_as_string?: string; };} }` |
| unfilteredRangeBounds  | the bounds of all unfiltered ranges (ex: 0 - 100), keyed by field name | `{ [<names of range fields>]: { min: { value: number; value_as_string?: string; }; max: { value: number; value_as_string?: string; };} }` |
| filteredDistribution   | the distribution of all filtered ranges, keyed by field name           | `{[<names of range fields>]: Array<{ key: number; doc_count: number; }>}`                                                                 |
| unfilteredDistribution | the distribution of all filtered ranges, keyed by field name           | `{[<names of range fields>]: Array<{ key: number; doc_count: number; }>}`                                                                 |

## Verbose Examples

### Set the context

```typescript
const defaultRangeConfig = {
    aggsEnabled: false,
    defaultFilterKind: 'should',
    getDistribution: true,
    getRangeBounds: true,
    rangeInterval: 1
};

type RF = 'instagram_avg_like_rate' | 'invites_pending' | 'user_profile_age';
const customRangeFieldConfig: RangeConfigs<RF> = {
    instagram_avg_like_rate: {
        field: 'instagram.avg_like_rate',
        defaultFilterKind: 'should',
        getDistribution: true,
        getRangeBounds: true,
        rangeInterval: 1
    },
    invites_pending: {
        field: 'invites.pending',
        defaultFilterKind: 'should',
        getDistribution: true,
        getRangeBounds: true,
        rangeInterval: 1
    },
    user_profile_age: {
        field: 'user_profile.age',
        defaultFilterKind: 'should',
        getDistribution: true,
        getRangeBounds: true,
        rangeInterval: 1
    }
};

const rangeFilter = new RangeFilterClass<RF>(defaultRangeConfig, customRangeFieldConfig);
const client = new Axios(process.env.ELASTIC_SEARCH_ENDPOINT);
const creatorCRM = new Manager<typeof rangeFilter>(client, {range: rangeFilter});

creatorCRM.runStartQuery();

export default {
    gqlClient: React.createContext(gqlClient),
    exampleForm: React.createContext(exampleFormInstance),
    creatorCRM: React.createContext(creatorCRM)
};
```

### Use a filter in a pure component

Example with incomplete code. See `dev/app/features/range_filter.tsx` for working feature.

```typescript
export default observer(({filterName, maxRange}) => {
    const {
        filters: {range}
    } = useContext(Context.creatorCRM);
    return (
        <RangeContainer>
            <ClearFilterButton onClick={() => range.clearFilter(filterName)}>
                clear filter
            </ClearFilterButton>
            <Dropdown
                options={['should', 'must']}
                onChange={option => {
                    range.setKind(filterName, ((option as any).value as unknown) as FilterKind);
                }}
                value={filterConfig.defaultFilterKind}
                placeholder={'Select a filter kind'}
            />

            <SliderContainer>
                <Range
                    max={
                        maxRange
                            ? maxRange
                            : unfilteredBounds.max > upperValue
                            ? unfilteredBounds.max
                            : upperValue
                    }
                    min={unfilteredBounds.min < lowerValue ? unfilteredBounds.min : lowerValue}
                    value={[lowerValue, upperValue]}
                    onChange={(v: number[]) => {
                        range.setFilter(filterName, {
                            lessThen: Math.round(v[1]),
                            greaterThen: Math.round(v[0])
                        });
                    }}
                />
            </SliderContainer>
            <VictoryChart>
                <VictoryLine
                    data={unfilteredData}
                    domain={{x: [unfilteredBounds.min, maxRange ? maxRange : unfilteredBounds.max]}}
                />
                <VictoryLine
                    data={filteredData}
                    domain={{
                        x: [
                            filteredBounds.min,
                            filteredBounds.max > maxRange ? maxRange : filteredBounds.max
                        ]
                    }}
                    style={{data: {stroke: '#0000ff', strokeWidth: 4, strokeLinecap: 'round'}}}
                />
            </VictoryChart>
        </RangeContainer>
    );
});
```
