import React from 'react';
import BigNumber from 'bignumber.js';
import styled from 'styled-components';
import { Input, variables, colors } from '@trezor/components';
import { useSendFormContext } from '@wallet-hooks';
import { getInputState } from '@wallet-utils/sendFormUtils';

const Wrapper = styled.div`
    display: 'flex';
    padding-left: 11px;
`;

const Units = styled.div`
    font-size: ${variables.FONT_SIZE.TINY};
    color: ${colors.NEUE_TYPE_LIGHT_GREY};
`;

export default () => {
    const { network, feeInfo, errors, register, composeTransaction } = useSendFormContext();
    const { maxFee, minFee } = feeInfo;
    const feePerUnitError = errors.feePerUnit;
    const feeLimitError = errors.feeLimit;

    return (
        <Wrapper>
            <Input
                noTopLabel
                variant="small"
                name="feePerUnit"
                width={120}
                state={getInputState(feePerUnitError)}
                innerAddon={
                    <Units>
                        {network.networkType === 'bitcoin' && 'sat/B'}
                        {network.networkType === 'ripple' && 'drops'}
                    </Units>
                }
                onChange={() => {
                    if (feePerUnitError || feeLimitError) return;
                    composeTransaction('feePerUnit');
                }}
                innerRef={register({
                    required: 'TR_CUSTOM_FEE_IS_NOT_SET',
                    validate: (value: string) => {
                        const feeBig = new BigNumber(value);
                        if (feeBig.isNaN()) {
                            return 'TR_CUSTOM_FEE_IS_NOT_NUMBER';
                        }

                        if (feeBig.isGreaterThan(maxFee) || feeBig.isLessThan(minFee)) {
                            return 'TR_CUSTOM_FEE_NOT_IN_RANGE';
                        }
                    },
                })}
                bottomText={feePerUnitError && feePerUnitError.message}
            />
            {network.networkType !== 'ethereum' && (
                <Input
                    variant="small"
                    name="feeLimit"
                    width={150}
                    state={getInputState(feeLimitError)}
                    onChange={() => {
                        if (feePerUnitError || feeLimitError) return;
                        composeTransaction('feeLimit');
                    }}
                    innerRef={register({
                        required: 'TR_CUSTOM_FEE_IS_NOT_SET',
                        validate: (value: string) => {
                            const feeBig = new BigNumber(value);
                            if (feeBig.isNaN()) {
                                return 'TR_CUSTOM_FEE_IS_NOT_NUMBER';
                            }

                            if (feeBig.isGreaterThan(maxFee) || feeBig.isLessThan(minFee)) {
                                return 'TR_CUSTOM_FEE_NOT_IN_RANGE';
                            }
                        },
                    })}
                    bottomText={feeLimitError && feeLimitError.message}
                />
            )}
        </Wrapper>
    );
};
