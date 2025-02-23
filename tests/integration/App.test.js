import assert from 'assert';
import React from 'react';
import TestRenderer from 'react-test-renderer';
import Settings from '../../screen/settings/Settings';
import Selftest from '../../screen/selftest';
import { Header } from '../../components/Header';

jest.mock('../../blue_modules/BlueElectrum', () => {
  return {
    connectMain: jest.fn(),
  };
});

it('Header works', () => {
  const rendered = TestRenderer.create(<Header />).toJSON();
  expect(rendered).toBeTruthy();
});

// eslint-disable-next-line jest/no-disabled-tests
it.skip('Settings work', () => {
  const rendered = TestRenderer.create(<Settings />).toJSON();
  expect(rendered).toBeTruthy();
});

it('Selftest work', () => {
  const component = TestRenderer.create(<Selftest />);
  const root = component.root;
  const rendered = component.toJSON();
  expect(rendered).toBeTruthy();
  // console.log((root.findAllByType('Text')[0].props));

  let okFound = false;
  const allTests = [];
  for (const v of root.findAllByType('Text')) {
    let text = v.props.children;
    if (text.join) {
      text = text.join('');
    }
    if (text === 'OK') {
      okFound = true;
    }
    allTests.push(text);
    // console.log(text);
  }

  assert.ok(okFound, 'OK not found. Got: ' + allTests.join('; '));
});
