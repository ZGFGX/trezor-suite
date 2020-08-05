import React from 'react';
import styled from 'styled-components';
import { colors, Modal, ConfirmOnDevice, Button } from '@trezor/components';
import { FiatValue, Translation } from '@suite-components';
import { useDevice, useActions } from '@suite-hooks';
import { formatNetworkAmount } from '@wallet-utils/accountUtils';
import * as sendFormActions from '@wallet-actions/sendFormActions';

import { Props } from './Container';
import Output, { OutputProps, Left, Right, Coin, Fiat, Symbol } from './components/Output';

const Bottom = styled.div`
    display: flex;
    flex-direction: column;
    width: 100%;
    border-top: 1px solid ${colors.NEUE_STROKE_GREY};
`;

const BottomContent = styled.div`
    padding: 20px 37px;
    display: flex;
    justify-content: space-between;
    flex: 1;
`;

const Content = styled.div`
    padding: 20px 20px 0 20px;
`;

const StyledButton = styled(Button)`
    display: flex;
    align-self: center;
    width: 240px;
`;

const getState = (index: number, buttonRequests: number) => {
    if (index === buttonRequests - 1) {
        return 'warning';
    }

    if (index < buttonRequests - 1) {
        return 'success';
    }

    return undefined;
};

export default ({ selectedAccount, send, ...props }: Props) => {
    const { device } = useDevice();
    const { cancelSignTx, pushTransaction } = useActions({
        cancelSignTx: sendFormActions.cancelSignTx,
        pushTransaction: sendFormActions.pushTransaction,
    });

    const { precomposedTx, precomposedForm, signedTx } = send;
    if (selectedAccount.status !== 'loaded' || !device || !precomposedTx || !precomposedForm)
        return null;

    const { symbol } = selectedAccount.account;
    // const outputSymbol = token ? token.symbol!.toUpperCase() : symbol.toUpperCase();

    const outputs: OutputProps[] = [];
    precomposedTx.transaction.outputs.forEach(o => {
        if (typeof o.address === 'string') {
            outputs.push({
                type: 'regular',
                label: o.address,
                value: o.amount,
            });
        } else if (o.script_type === 'PAYTOOPRETURN') {
            outputs.push({
                type: 'opreturn',
                value: o.op_return_data,
            });
        }
    });

    if (typeof precomposedForm.bitcoinLockTime === 'string') {
        outputs.push({ type: 'locktime', value: precomposedForm.bitcoinLockTime });
    }

    outputs.push({ type: 'fee', value: precomposedTx.fee });

    // omit other button requests (like passphrase)
    const buttonRequests = device.buttonRequests.filter(
        r => r === 'ButtonRequest_ConfirmOutput' || r === 'ButtonRequest_SignTx',
    );

    return (
        <Modal
            size="large"
            padding={['20px', '0', '20px', '0']}
            header={
                <ConfirmOnDevice
                    title={<Translation id="TR_CONFIRM_ON_TREZOR" />}
                    steps={outputs.length}
                    activeStep={buttonRequests.length}
                    trezorModel={device.features?.major_version === 1 ? 1 : 2}
                    successText={<Translation id="TR_CONFIRMED_TX" />}
                    onCancel={cancelSignTx}
                />
            }
            bottomBar={
                <Bottom>
                    <BottomContent>
                        <Left>
                            <Translation
                                id="TR_TOTAL_SYMBOL"
                                values={{ symbol: symbol.toUpperCase() }}
                            />
                        </Left>
                        <Right>
                            <Coin bold>
                                {formatNetworkAmount(precomposedTx.totalSpent, symbol)}
                                <Symbol>{symbol}</Symbol>
                            </Coin>
                            <Fiat>
                                <FiatValue
                                    amount={formatNetworkAmount(precomposedTx.totalSpent, symbol)}
                                    symbol={symbol}
                                />
                            </Fiat>
                        </Right>
                    </BottomContent>
                    <StyledButton
                        isDisabled={!signedTx}
                        onClick={async () => {
                            const result = await pushTransaction();
                            // @ts-ignore: type modal decision
                            props.decision.resolve(result);
                        }}
                    >
                        <Translation id="TR_SEND" />
                    </StyledButton>
                </Bottom>
            }
        >
            <Content>
                {outputs.map((output, index) => {
                    const state = signedTx ? 'success' : getState(index, buttonRequests.length);
                    // it's safe to use array index since outputs do not change
                    // eslint-disable-next-line react/no-array-index-key
                    return <Output key={index} {...output} state={state} symbol={symbol} />;
                })}
            </Content>
        </Modal>
    );
};
