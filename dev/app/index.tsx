import React from 'react';
import styled from 'styled-components';

import {ApiUri, ApiAccessToken, RangeFilter, ResultsTable, FilterSelector, BooleanFilter} from './features';

const Main = styled.div`
    height: 100vh;
    width: 100vw;
    background-color: white;
    display: flex;
    justify-content: top;
    align-items: center;
    flex-direction: column;
    font-size: 14px;
    font-family: 'Roboto';
`;

const HorizontalLayout = styled.div`
    display: flex;
`;

export default () => (
    <Main>
        <ApiUri />
        <ApiAccessToken />
        <HorizontalLayout>
            <FilterSelector filterType={'range'} defaultFilterName={'instagram_avg_like_rate'}>
                {filterName => <RangeFilter filterName={filterName} maxRange={50} />}
            </FilterSelector>
            <FilterSelector filterType={'range'} defaultFilterName={'invites_pending'}>
                {filterName => <RangeFilter filterName={filterName} maxRange={50} />}
            </FilterSelector>
            <FilterSelector filterType={'boolean'} defaultFilterName={'instagram.is_business'}>
                {filterName => <BooleanFilter filterName={filterName}/>}
            </FilterSelector>
        </HorizontalLayout>
        <ResultsTable />
    </Main>
);
