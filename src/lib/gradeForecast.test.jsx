import { describe, expect, it } from 'vitest';
import { forecastGrades, parseGradeNumber } from './gradeForecast.js';

const known = (score, weight, name = 'Quiz') => ({ name, kind: 'known', score, weight });
const exam = (kind, weight, score = '') => ({ name: kind, kind, score, weight });
describe('FE/PE weighted score forecast', () => {
  it('applies user-entered syllabus floors and rejects known exam scores below the floor', () => {
    expect(forecastGrades([known('9','60'),{...exam('FE','40'),minimum:'4,05'}]).needed).toBe(4.1);
    expect(forecastGrades([known('9','60'),{...exam('FE','40','3'),minimum:'4'}]).errors.join()).toContain('dưới ngưỡng');
    const pair=forecastGrades([known('9','60'),{...exam('FE','20'),minimum:'6.02'},{...exam('PE','20'),minimum:'4.05'}]);
    expect(pair.sameScore).toBe(6.1);expect(pair.scenarios[4].reason).toContain('dưới ngưỡng');expect(pair.scenarios[5].fe).toBe(6.1);
    expect(forecastGrades([known('9','60'),{...exam('FE','40'),minimum:'11'}]).errors.length).toBeGreaterThan(0);
  });
  it('uses a strict >5 threshold, and rounds recommendations upward to 0.1', () => {
    const result = forecastGrades([known('5', '60'), exam('FE', '40')]);
    expect(result.errors).toEqual([]);
    expect(result.needed).toBe(5.1);
    expect(result.total).toBe(5.04);
    expect(forecastGrades([known('5', '60'), exam('FE', '40', '5')]).status).toBe('failed');
  });
  it('accepts zero and Vietnamese decimal comma without treating zero as missing', () => {
    expect(parseGradeNumber('0')).toBe(0);
    expect(parseGradeNumber('8,5')).toBe(850);
    const result = forecastGrades([known('0', '10'), known('8,5', '50'), exam('PE', '40')]);
    expect(result.needed).toBe(1.9);
    expect(result.total).toBe(5.01);
    expect(forecastGrades([known('10', '60'), exam('PE', '40', '0')]).status).toBe('passed');
  });
  it('uses exact percentage sums, including decimal percentages', () => {
    expect(forecastGrades([known('5', '33,33'), known('5', '33.33'), exam('FE', '33.34')]).needed).toBe(5.1);
    expect(forecastGrades([known('5', '33.33'), known('5', '33.33'), exam('FE', '33.33')]).errors.join()).toContain('đúng 100%');
  });
  it('reports impossible when maximum is below or exactly five', () => {
    for (const weight of ['40', '50']) {
      const result = forecastGrades([known('0', String(100 - Number(weight))), exam('FE', weight)]);
      expect(result.status).toBe('impossible');
      expect(result.maximum).toBeLessThanOrEqual(5);
    }
  });
  it('allows zero exam score when the known contribution already exceeds five', () => {
    const result = forecastGrades([known('9', '60'), exam('FE', '40')]);
    expect(result.needed).toBe(0);
    expect(result.total).toBe(5.4);
  });
  it('handles the last attainable tenth before the score limit', () => {
    const result = forecastGrades([known('0.01', '50'), exam('PE', '50')]);
    expect(result.needed).toBe(10);
    expect(result.total).toBe(5.005);
  });
  it('solves FE/PE jointly; each displayed pair passes and is minimal on a tenth grid', () => {
    const result = forecastGrades([known('5', '60'), exam('FE', '25'), exam('PE', '15')]);
    expect(result.status).toBe('pair');
    expect(result.sameScore).toBe(5.1);
    expect(result.total).toBe(5.04);
    for (const row of result.scenarios) {
      if (row.fe == null) {
        expect(3 + 10 * .25 + row.pe * .15).toBeLessThanOrEqual(5);
      } else {
        expect(row.total).toBeGreaterThan(5);
        expect(row.total).toBeLessThanOrEqual(10);
        if (row.fe > 0) expect(3_000_000 + Math.round((row.fe - .1) * 100) * 2500 + row.pe * 100 * 1500).toBeLessThanOrEqual(5_000_000);
      }
    }
  });
  it('a scored PE becomes fixed when predicting FE', () => {
    const result = forecastGrades([known('5', '60'), exam('PE', '20', '6'), exam('FE', '20')]);
    expect(result.status).toBe('single');
    expect(result.exam).toBe('FE');
    expect(result.needed).toBe(4.1);
  });
  it('when all scores exist returns actual weighted total rather than a prediction', () => {
    expect(forecastGrades([known('5.01', '100')])).toMatchObject({ status: 'passed', total: 5.01 });
    expect(forecastGrades([known('5', '100')])).toMatchObject({ status: 'failed', total: 5 });
  });
  it('does not round an actual total of 5.000001 down when deciding the result', () => {
    expect(forecastGrades([known('5', '99.99'), known('5.01', '0.01')])).toMatchObject({ status: 'passed', total: 5.000001 });
  });
  it.each(['-1', '10.01', 'NaN', 'Infinity', '1e1', '8/10', '5.123', 'abc'])('rejects invalid score %s', value => {
    expect(forecastGrades([known(value, '60'), exam('FE', '40')]).errors.length).toBeGreaterThan(0);
  });
  it.each(['0', '-1', '101', '', '1e2', '50.001'])('rejects invalid weight %s', weight => {
    expect(forecastGrades([known('5', weight), exam('FE', '40')]).errors.length).toBeGreaterThan(0);
  });
  it('rejects missing known grades, duplicate exams and an invalid total', () => {
    expect(forecastGrades([known('', '60'), exam('FE', '40')]).errors.join()).toContain('nhập điểm đã có');
    expect(forecastGrades([exam('FE', '50'), exam('FE', '50')]).errors.join()).toContain('một cột FE');
    expect(forecastGrades([known('5', '70'), exam('FE', '40')]).errors.join()).toContain('đúng 100%');
    expect(forecastGrades([]).errors.length).toBeGreaterThan(0);
    expect(forecastGrades(Array.from({ length: 31 }, () => known('5', '1'))).errors.length).toBeGreaterThan(0);
  });
  it('single-exam recommendations are sufficient and minimal over a range of inputs', () => {
    for (let score = 0; score <= 10; score++) for (let weight = 10; weight < 100; weight += 10) {
      const result = forecastGrades([known(String(score), String(100 - weight)), exam('FE', String(weight))]);
      if (result.status === 'impossible') expect(result.maximum).toBeLessThanOrEqual(5);
      else {
        expect(result.total).toBeGreaterThan(5);
        expect(result.needed).toBeLessThanOrEqual(10);
        if (result.needed > 0) expect(score * 100 * (100 - weight) * 100 + Math.round((result.needed - .1) * 100) * weight * 100).toBeLessThanOrEqual(5_000_000);
      }
    }
  });
});
it('matches the FE and PE floors, including rounding a floor up to the next tenth', () => {
  const result=forecastGrades([
    {name:'Quiz',kind:'known',weight:'50',score:'10'},
    {name:'FE',kind:'FE',weight:'25',score:'',minimum:'4,55'},
    {name:'PE',kind:'PE',weight:'25',score:'',minimum:'6'},
  ]);
  expect(result.sameScore).toBe(6);
  expect(result.scenarios[5]).toMatchObject({fe:null,reason:'PE dưới ngưỡng đã nhập'});
  expect(result.scenarios[6].fe).toBe(4.6);
});
