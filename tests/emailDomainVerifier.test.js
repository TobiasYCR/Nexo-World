import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EmailDomainVerifier } from '../server/accounts/EmailDomainVerifier.js';

const silentLogger = { warn() {}, error() {} };

function dnsError(code) {
  const err = new Error(code);
  err.code = code;
  return err;
}

test('acepta dominios que tienen registros MX válidos', async () => {
  const calls = [];
  const verifier = new EmailDomainVerifier({
    resolveMx: async (domain) => {
      calls.push(domain);
      return [{ exchange: 'gmail-smtp-in.l.google.com', priority: 5 }];
    },
    logger: silentLogger
  });

  assert.equal(await verifier.verify('Usuario@Gmail.COM '), null);
  assert.deepEqual(calls, ['gmail.com']);
});

test('rechaza dominios y TLDs reservados sin consultar DNS', async () => {
  let called = false;
  const verifier = new EmailDomainVerifier({
    resolveMx: async () => {
      called = true;
      return [{ exchange: 'mx.example.com', priority: 10 }];
    },
    logger: silentLogger
  });

  const reserved = [
    'a@nexo.test',
    'a@nexo-world.test',
    'a@algo.invalid',
    'a@maquina.local',
    'a@mi.localhost',
    'a@demo.example',
    'a@example.com',
    'a@sub.example.org'
  ];
  for (const email of reserved) {
    assert.equal(await verifier.verify(email), 'invalid-email-domain', email);
  }
  assert.equal(called, false);
});

test('rechaza dominios sin MX, con Null MX (RFC 7505) o inexistentes (ENOTFOUND / ENODATA)', async () => {
  const cases = [
    ['sin registros', async () => []],
    ['Null MX punto', async () => [{ exchange: '.', priority: 0 }]],
    ['Null MX vacío', async () => [{ exchange: '  ', priority: 0 }]],
    ['ENOTFOUND', async () => { throw dnsError('ENOTFOUND'); }],
    ['ENODATA', async () => { throw dnsError('ENODATA'); }]
  ];

  for (const [label, resolveMx] of cases) {
    const verifier = new EmailDomainVerifier({ resolveMx, logger: silentLogger });
    assert.equal(await verifier.verify('alguien@dominio-falso.com'), 'invalid-email-domain', label);
  }
});

test('devuelve email-verification-unavailable ante errores transitorios o timeout sin cachearlos', async () => {
  let attempts = 0;
  const verifier = new EmailDomainVerifier({
    resolveMx: async () => {
      attempts += 1;
      if (attempts === 1) throw dnsError('ESERVFAIL');
      return [{ exchange: 'mx.real.com', priority: 10 }];
    },
    logger: silentLogger
  });

  assert.equal(await verifier.verify('alguien@real.com'), 'email-verification-unavailable');
  assert.equal(await verifier.verify('alguien@real.com'), null, 'no cachea errores transitorios');
  assert.equal(attempts, 2);

  const slowVerifier = new EmailDomainVerifier({
    resolveMx: () => new Promise(() => {}),
    timeoutMs: 25,
    logger: silentLogger
  });
  assert.equal(await slowVerifier.verify('alguien@lento.com'), 'email-verification-unavailable');
});

test('cachea resultados válidos e inválidos hasta que vence su TTL', async () => {
  let now = 1_000_000;
  let calls = 0;
  const verifier = new EmailDomainVerifier({
    resolveMx: async (domain) => {
      calls += 1;
      if (domain === 'ok.com') return [{ exchange: 'mx.ok.com', priority: 10 }];
      throw dnsError('ENOTFOUND');
    },
    clock: () => now,
    validTtlMs: 60_000,
    invalidTtlMs: 10_000,
    logger: silentLogger
  });

  assert.equal(await verifier.verify('uno@ok.com'), null);
  assert.equal(await verifier.verify('dos@ok.com'), null);
  assert.equal(calls, 1, 'reutiliza caché dentro del TTL');

  now += 60_001;
  assert.equal(await verifier.verify('tres@ok.com'), null);
  assert.equal(calls, 2, 'vuelve a consultar cuando vence el TTL');

  assert.equal(await verifier.verify('uno@malo.com'), 'invalid-email-domain');
  assert.equal(await verifier.verify('dos@malo.com'), 'invalid-email-domain');
  assert.equal(calls, 3, 'cachea negativos');

  now += 10_001;
  assert.equal(await verifier.verify('tres@malo.com'), 'invalid-email-domain');
  assert.equal(calls, 4);
});

test('si enabled es false, permite cualquier dominio sin consultar DNS', async () => {
  let called = false;
  const verifier = new EmailDomainVerifier({
    enabled: false,
    resolveMx: async () => {
      called = true;
      return [];
    },
    logger: silentLogger
  });

  assert.equal(await verifier.verify('alguien@nexo.test'), null);
  assert.equal(called, false);
});
