import React, { useEffect } from 'react';
import styled from 'styled-components';
import { BuyTradeQuoteRequest } from 'invity-api';
// import { Account } from '@wallet-types';
import { useSelector, useActions } from '@suite/hooks/suite';
import invityAPI from '@suite-services/invityAPI';
import { processQuotes } from '@wallet-utils/coinmarket/buyUtils';
import * as routerActions from '@suite-actions/routerActions';
import * as coinmarketBuyActions from '@wallet-actions/coinmarketBuyActions';

const Wrapper = styled.div`
    display: flex;
    justify-content: center;
    align-items: center;
    flex: 1;
    height: 100%;
`;

const CoinmarketRedirect = () => {
    const { goto } = useActions({ goto: routerActions.goto });
    const { saveQuoteRequest, saveQuotes } = useActions({
        saveQuoteRequest: coinmarketBuyActions.saveQuoteRequest,
        saveQuotes: coinmarketBuyActions.saveQuotes,
    });
    const router = useSelector(state => state.router);
    const params = router?.hash?.split('/');

    useEffect(() => {
        if (!params) return;

        const routeType = params[0];
        const redirectWithQuotes = async () => {
            if (routeType === 'offers') {
                const wantCrypto = params[4] === 'qc';
                const request: BuyTradeQuoteRequest = {
                    wantCrypto,
                    fiatCurrency: params[6],
                    receiveCurrency: params[8],
                    country: params[5],
                    fiatStringAmount: params[7],
                    cryptoStringAmount: params[7],
                };

                await saveQuoteRequest(request);
                const allQuotes = await invityAPI.getBuyQuotes(request);
                const [quotes, alternativeQuotes] = processQuotes(allQuotes);
                await saveQuotes(quotes, alternativeQuotes);

                const accountItems = {
                    symbol: params[1],
                    accountIndex: params[3],
                    accountType: params[2],
                };

                // @ts-ignore TODO FIX THIS TS
                goto('wallet-coinmarket-buy-offers', { ...accountItems });
            }
        };
        redirectWithQuotes();
    });

    return <Wrapper>Redirecting ...</Wrapper>;
};

export default CoinmarketRedirect;
