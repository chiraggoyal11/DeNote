const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { applySm2 } = require('../utils/spacedRepetition');

describe('spacedRepetition.applySm2', () => {
    it('resets repetitions on low quality', () => {
        const next = applySm2({ easeFactor: 2.5, repetitions: 4, intervalDays: 10, lapses: 0 }, 1);
        assert.equal(next.repetitions, 0);
        assert.equal(next.intervalDays, 1);
        assert.equal(next.lapses, 1);
        assert.equal(next.countedCorrect, false);
    });

    it('schedules first success for 1 day then 6 days', () => {
        const first = applySm2({ easeFactor: 2.5, repetitions: 0, intervalDays: 0 }, 4);
        assert.equal(first.repetitions, 1);
        assert.equal(first.intervalDays, 1);
        assert.equal(first.countedCorrect, true);

        const second = applySm2({
            easeFactor: first.easeFactor,
            repetitions: first.repetitions,
            intervalDays: first.intervalDays
        }, 5);
        assert.equal(second.repetitions, 2);
        assert.equal(second.intervalDays, 6);
    });

    it('clamps ease factor to [1.3, 3.0]', () => {
        let card = { easeFactor: 1.3, repetitions: 5, intervalDays: 20, reviewCount: 5, correctCount: 5 };
        for (let i = 0; i < 20; i++) {
            card = { ...card, ...applySm2(card, 0) };
        }
        assert.ok(card.easeFactor >= 1.3);
        assert.ok(card.easeFactor <= 3.0);
    });
});
