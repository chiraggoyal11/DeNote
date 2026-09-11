const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const heuristic = require('../utils/ai/heuristicProvider');
const {
    suggestedSummarySentenceCount,
    cleanExtractedText
} = require('../utils/ai/noteDocumentText');

const SAMPLE_DOC = `
Operating Systems Overview. An operating system manages hardware and software resources on a computer.
Process Management. A process is a program in execution. The OS schedules processes using algorithms such as round robin and priority scheduling.
Memory Management. Virtual memory allows processes to use more memory than physically available by paging and swapping.
File Systems. The file system organizes data on disk into files and directories with permissions and metadata.
Deadlocks. A deadlock occurs when processes wait forever for resources held by each other. Prevention, avoidance, and detection are common strategies.
Synchronization. Semaphores and mutexes help coordinate concurrent processes and avoid race conditions.
Device Drivers. Device drivers translate OS I/O requests into hardware-specific commands for peripherals.
Security. Access control, authentication, and isolation protect system integrity against unauthorized users.
`.repeat(3);

describe('noteDocumentText helpers', () => {
    it('scales summary sentence budget', () => {
        assert.ok(suggestedSummarySentenceCount(SAMPLE_DOC) >= 5);
        assert.equal(suggestedSummarySentenceCount('tiny'), 3);
    });

    it('cleans extracted text', () => {
        const cleaned = cleanExtractedText('Hello\n\n\n\nWorld\t\tthere');
        assert.match(cleaned, /Hello/);
        assert.doesNotMatch(cleaned, /\n{3,}/);
    });
});

describe('heuristic Note AI from document text', () => {
    const note = {
        _id: 'n1',
        title: 'OS Cheat Sheet',
        subject: 'OS',
        branch: 'CSE',
        sem: '4',
        description: 'Quick OS notes',
        tags: ['os', 'scheduling'],
        resourceType: 'cheat_sheet',
        documentText: SAMPLE_DOC,
        documentMeta: { source: 'pdf', pageCount: 4, chars: SAMPLE_DOC.length }
    };

    it('summarize uses PDF body content', async () => {
        const result = await heuristic.summarize({ note });
        assert.match(result.method, /pdf/);
        assert.ok(result.summary.length > 80);
        assert.ok(result.summary.toLowerCase().includes('process') || result.summary.toLowerCase().includes('memory') || result.summary.toLowerCase().includes('operating'));
        assert.ok(Array.isArray(result.bullets) && result.bullets.length >= 3);
        assert.equal(result.document.source, 'pdf');
    });
});
