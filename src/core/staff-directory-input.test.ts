import { describe, expect, it } from 'vitest';
import { directoryOffset, staffDirectoryInput } from './staff-directory-input';

const valid = {
  teachingStatus: 'non_teaching',
  designation: 'Placement Coordinator',
  subjects: ['Placement'],
  sectionIds: [
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
  ],
};

describe('staff directory input', () => {
  it('accepts descriptive custom designations and both sections without turning them into roles', () => {
    expect(staffDirectoryInput(valid).p_section_ids).toHaveLength(2);
  });
  it.each([
    { isAdmin: true },
    { role: 'admin' },
    { responsibility: 'hod' },
    { counselorStudentIds: [] },
    { teachingStatus: 'other' },
    { designation: 'x'.repeat(121) },
    { subjects: [''] },
    { subjects: ['Java', ' java '] },
    { subjects: Array.from({ length: 21 }, (_, i) => `S${i}`) },
    { sectionIds: ['bad'] },
    { sectionIds: [valid.sectionIds[0], valid.sectionIds[0]] },
  ])('rejects invalid or privileged data: %j', (change) => {
    expect(() => staffDirectoryInput({ ...valid, ...change })).toThrow();
  });
});

describe('counselor page offset', () => {
  it('accepts the bounded default and a later page', () => {
    expect(directoryOffset('http://localhost/api/counselor/students')).toBe(0);
    expect(
      directoryOffset('http://localhost/api/counselor/students?offset=50'),
    ).toBe(50);
  });
  it.each([
    'offset=-1',
    'offset=10001',
    'offset=1&offset=2',
    'studentId=other',
  ])('rejects unsupported query %s', (query) => {
    expect(() =>
      directoryOffset(`http://localhost/api/counselor/students?${query}`),
    ).toThrow();
  });
});
