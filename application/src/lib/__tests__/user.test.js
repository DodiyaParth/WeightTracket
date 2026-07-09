import { describe, it, expect } from 'vitest';
import { initialsOf, firstNameOf } from '../user.js';

describe('initialsOf', () => {
  it('uses the first letters of the first two words', () => {
    expect(initialsOf('Parth Dodiya', 'x@y.com')).toBe('PD');
  });

  it('takes the first two letters of a single-word name', () => {
    expect(initialsOf('Parth', 'x@y.com')).toBe('PA');
  });

  it('falls back to the email when there is no name', () => {
    expect(initialsOf('', 'zoe@y.com')).toBe('ZO');
    expect(initialsOf(null, 'ab@y.com')).toBe('AB');
  });

  it('returns ? when there is neither name nor email', () => {
    expect(initialsOf('', '')).toBe('?');
    expect(initialsOf(null, null)).toBe('?');
  });
});

describe('firstNameOf', () => {
  it('returns the first word of a full name', () => {
    expect(firstNameOf('Parth Dodiya', 'x@y.com')).toBe('Parth');
  });

  it('returns a single-word name as-is', () => {
    expect(firstNameOf('Parth', 'x@y.com')).toBe('Parth');
  });

  it('falls back to the email local-part when there is no name', () => {
    expect(firstNameOf('', 'zoe@y.com')).toBe('zoe');
    expect(firstNameOf('   ', 'sam@y.com')).toBe('sam');
  });

  it('returns "there" when there is neither name nor email', () => {
    expect(firstNameOf('', '')).toBe('there');
    expect(firstNameOf(null, null)).toBe('there');
  });
});
