# Boss GLB Assets

Date added: 2026-07-05

These files are optimized derivatives of user-provided local GLB files. The original source/license metadata was not provided in-repo at the time of import.

Optimization:

- Tool: `@gltf-transform/cli` 4.4.1
- Texture size: 2048
- Texture format: embedded WebP
- Mesh simplification: disabled
- Geometry compression: disabled
- Vertex attributes: preserved from the raw GLBs; position, normal, UV, and index arrays were verified byte-for-byte after conversion
- Vertex layout: separate/tightly packed, to keep compatibility with the game's lightweight custom GLB loader
- Raw working files are excluded from git under `.asset_work/`

Mappings:

- `kappa_boss_2048.glb`: shape-preserving optimized derivative of `boss_candidate_a.glb`
- `chochin_boss_2048.glb`: shape-preserving optimized derivative of `boss_candidate_b.glb`
- `hitodama_boss_2048.glb`: shape-preserving optimized derivative of `boss_candidate_c.glb`
- `oni_boss_2048.glb`: shape-preserving optimized derivative of `boss_candidate_d.glb`

