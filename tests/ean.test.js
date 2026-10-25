import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ean13CheckDigit,
  ean13Modules,
  ean13Svg,
  generateEan13,
  isValidEan13,
  makeEan13
} from '../assets/js/ean.js';

test('حساب رقم التحقق EAN-13', () => {
  assert.equal(ean13CheckDigit('400638133393'), '1');
  assert.equal(makeEan13('400638133393'), '4006381333931');
  assert.equal(isValidEan13('4006381333931'), true);
  assert.equal(isValidEan13('4006381333932'), false);
});

test('توليد باركودات EAN-13 فريدة وصالحة', () => {
  const codes = Array.from({ length: 30 }, () => generateEan13());
  assert.equal(new Set(codes).size, 30);
  codes.forEach((code) => {
    assert.equal(code.length, 13);
    assert.equal(isValidEan13(code), true);
  });
});

test('رسم وحدات EAN-13 بطول قياسي', () => {
  const modules = ean13Modules('4006381333931');
  assert.equal(modules.length, 95);
  assert.match(ean13Svg('4006381333931'), /<svg/);
  assert.equal(ean13Svg('123'), '');
});
