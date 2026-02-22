const selfsigned = require('selfsigned');
const fs = require('fs');

async function generate() {
    console.log('Generating self-signed certificate (async)...');
    const attrs = [{ name: 'commonName', value: 'localhost' }];
    const pems = await selfsigned.generate(attrs, { days: 365 });

    fs.writeFileSync('key.pem', pems.private);
    fs.writeFileSync('cert.pem', pems.cert);

    console.log('key.pem and cert.pem generated successfully.');
}

generate().catch(err => {
    console.error('Failed to generate certs:', err);
    process.exit(1);
});
