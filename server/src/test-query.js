async function test() {
    const reqs = [
        { table: 'applicants', select: '*', filters: [{ column: 'user_id', op: 'eq', value: '123' }] }
    ];

    for (const r of reqs) {
        console.log(`\nTesting: ${JSON.stringify(r)}`);
        try {
            const res = await fetch('http://localhost:3001/api/data/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(r)
            });
            console.log('Status:', res.status);
            console.log('Response:', await res.text());
        } catch (e) {
            console.error(e);
        }
    }
}
test();
