# Security Checklist

Run this before every commit touching auth, networking, or storage.

- [ ] UCAN expiry + revocation implemented
- [ ] No private keys in bundles or source code
- [ ] OrbitDB encryption enabled where applicable
- [ ] `swarm.key` isolated and never logged/transmitted
- [ ] New auth/network behavior documented in `docs/threat-model.md`
- [ ] Offline revocation path exists and is tested
- [ ] DID/CID/UCAN input validation covered by tests
- [ ] Performance targets validated for touched features
