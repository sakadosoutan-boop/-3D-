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

- `kappa_boss_2048.glb`: shape-preserving optimized derivative of the prior `chochin_boss_2048.glb`
- `chochin_boss_2048.glb`: shape-preserving optimized derivative of the prior `oni_boss_2048.glb`
- `hitodama_boss_2048.glb`: shape-preserving optimized derivative of the prior `kappa_boss_2048.glb`
- `oni_boss_2048.glb`: shape-preserving optimized derivative of the prior `hitodama_boss_2048.glb`
- `kitsune_boss_balanced.glb`: mobile-balanced derivative of `Manex3D-generated-model_9a0f501e9f5a_1782132793278.glb`; mesh simplification kept conservative to avoid returning to the procedural low-poly fox
- `yuki_boss_balanced.glb`: mobile-balanced derivative of `Manex3D-generated-model_f8c11fd36f62_1782133320333.glb`; mesh simplification kept conservative for faster boss entry loading
