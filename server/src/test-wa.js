async function test() {
    try {
        const res = await fetch('http://localhost:3001/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test' },
            body: JSON.stringify({ phone: '08123', templateKey: 'test' })
        });

        console.log('Status:', res.status);
        const text = await res.text();
        console.log('Body:', text);
    } catch (e) {
        console.error(e);
    }
}

test();
