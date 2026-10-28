import { describe, expect, it } from 'vitest';
import { supervisionActivityQuery, supervisionQuery } from './calendar-input';

const department = '11111111-1111-4111-8111-111111111111';
const activity = '22222222-2222-4222-8222-222222222222';
const base = `http://localhost/api/supervision/activities?department=${department}`;
describe('selected Activity supervision input', () => {
  it('preserves the all-activities query and parses an optional Activity', () => {
    expect(supervisionActivityQuery(base)).toEqual({
      ...supervisionQuery(base),
      p_activity: null,
    });
    expect(
      supervisionActivityQuery(`${base}&activity=${activity}&offset=50`),
    ).toEqual({
      p_department: department,
      p_section: null,
      p_activity: activity,
      p_offset: 50,
    });
  });
  it('rejects malformed, duplicated and unknown filters', () => {
    for (const suffix of [
      '&activity=',
      '&activity=bad',
      `&activity=${activity}&activity=${activity}`,
      '&offset=-1',
      '&offset=10001',
      '&unknown=1',
      '&section=bad',
    ])
      expect(() => supervisionActivityQuery(base + suffix)).toThrow();
    expect(() => supervisionQuery(`${base}&activity=${activity}`)).toThrow();
  });
});
