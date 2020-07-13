import React from 'react';
import styled from 'styled-components';

import { Translation } from '@suite-components';
import { Button } from '@trezor/components';

const Wrapper = styled.div``;

export default () => {
    return (
        <Wrapper>
            <Button variant="tertiary" icon="LABEL" onClick={() => {}}>
                <Translation id="TR_ADD_LABEL" />
            </Button>
        </Wrapper>
    );
};
