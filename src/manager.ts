'use strict';
import {RangeFilterClass} from 'filters';
import {ESRequest, ESResponse} from 'types';
import {objKeys} from './utils';
import axios from 'axios';
import {decorate, observable, runInAction, reaction} from 'mobx';

type Filters<RangeFilter extends RangeFilterClass<any>> = {
    range: RangeFilter;
};

const BLANK_ES_REQUEST = {
    query: {
        bool: {
            must: [],
            should: []
        }
    },
    aggs: {}
};

// tslint:disable-next-line
const removeEmptyArrays = <O extends {}>(data: O): any => {
    objKeys(data).forEach(k => {
        const v = data[k];
        if (Array.isArray(v)) {
            if (v.length === 0) {
                delete data[k];
            }
        } else if (typeof v === 'object') {
            return removeEmptyArrays(v);
        }
    });
    return data;
};

class Manager<RangeFilter extends RangeFilterClass<any>> {
    public filters: Filters<RangeFilter>;
    public results: object[];

    constructor(filters: Filters<RangeFilter>) {
        runInAction(() => {
            this.filters = filters;
        });

        reaction(
            () => ({...this.filters.range.rangeFilters}),
            () => {
                console.log('Detected range filter change');
                this.runFilterQuery();
            }
        );
    }

    public runStartQuery = async () => {
        const request = this.createStartRequest();
        console.log('REQUEST', request);
        const response = await this.queryES(request);
        this.parseStartResponse(response);
    };

    public runFilterQuery = async () => {
        console.log('Running filter query');
        const request = this.createFilterRequest();
        console.log('REQUEST', JSON.stringify(removeEmptyArrays(request)));

        const response = await this.queryES(removeEmptyArrays(request));
        console.log(response);
        this.parseFilterResponse(response);
    };

    public queryES = async (request: ESRequest): Promise<ESResponse> => {
        const {data} = await axios.get(
            'https://search-sn-sandbox-mphutfambi5xaqixojwghofuo4.us-east-1.es.amazonaws.com/leads/_search',
            {
                params: {
                    source: JSON.stringify(request),
                    source_content_type: 'application/json'
                }
            }
        );
        return data;
        // .then(res => {
        //     console.log(res); // tslint:disable-line
        // });
    };

    public createStartRequest = (): ESRequest => {
        return objKeys(this.filters).reduce((request, filterName) => {
            const filter = this.filters[filterName];
            if (!filter) {
                return request;
            }
            const newRequest = filter.addToStartRequest(request);
            console.log('newRequest', newRequest);
            return newRequest;
        }, BLANK_ES_REQUEST as ESRequest);
    };

    public createFilterRequest = (): ESRequest => {
        return objKeys(this.filters).reduce((request, filterName) => {
            const filter = this.filters[filterName];
            if (!filter) {
                return request;
            }
            return filter.addToFilterRequest(request);
        }, BLANK_ES_REQUEST as ESRequest);
    };

    public parseStartResponse = (response: ESResponse): void => {
        objKeys(this.filters).forEach(filterName => {
            const filter = this.filters[filterName];
            if (!filter) {
                return;
            }
            filter.parseStartResponse(response);
        });
    };

    public parseFilterResponse = (response: ESResponse): void => {
        objKeys(this.filters).forEach(filterName => {
            const filter = this.filters[filterName];
            if (!filter) {
                return;
            }
            filter.parseFilterResponse(response);
        });
    };
}

decorate(Manager, {
    filters: observable,
    results: observable
    // runStartQuery: action,
    // runFilterQuery: action,
    // parseFilterResponse: action,
    // parseStartResponse: action
});

export default Manager;

// type RF = 'instagram_avg_like_rate';
// const defaultRangeConfig: RangeConfigs<RF> = {
//     instagram_avg_like_rate: {
//         field: 'instagram.avg_like_rate',
//         defaultFilterType: 'should',
//         getDistribution: true,
//         getRangeBounds: true,
//         rangeInterval: 1
//     }
//     // age: {
//     //     field: 'age',
//     //     defaultFilterType: 'should',
//     //     getDistribution: false,
//     //     getRangeBounds: true,
//     //     rangeInterval: 1
//     // }
// };

// const rangeFilter = new RangeFilterClass<RF>({rangeConfig: defaultRangeConfig});
// const creatorCRM = new Manager<typeof rangeFilter>(rangeFilter);

// creatorCRM.runStartQuery();

// creatorCRM.range.rangeFilters['instagram_avg_like_rate'];
