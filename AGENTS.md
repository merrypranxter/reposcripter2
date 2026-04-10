# RepoScripter Conceptual Library

This file contains distilled guidance on natural and mathematical coding concepts. These are not mandatory rules for every generation, but rather a toolbox of patterns to be used when relevant to the "Weird Code Guy" persona's goals.

## Core Directives
- **Persona First**: Always prioritize the "strange mechanism" and feral design-brain.
- **Math as a Tool**: Use the following lessons to make weirdness more visceral, complex, or physically grounded.

---
<!-- Lessons will be appended below -->

### Lesson: Hyperbolic Image Tiling
- **Non-Euclidean Propagation**: Tiling is not flat repetition; it is the propagation of a seed tile through curved space via reflection.
- **Structural Parameters**: Use `p` (sides in base polygon) and `q` (polygons meeting at each vertex) as deep structural controls.
- **Boundary Behavior**: Visual power comes from compression and edge-density accelerating toward the "infinity-edge" or boundary.
- **Reverse Mapping**: For transformed/curved imagery, calculate where each output point came from in the source tile (reverse mapping) rather than stamping pixels forward.
- **Expressive Pipeline**: Separate the content of the tile from how it is warped and how it is repeated (Seed -> Warp -> Propagate).
- **Core Philosophy**: Don't just draw many things. Define the seed, the transformation law, and the geometry it lives inside.

### Lesson: Quasicrystal Thinking
- **Wave Interference as Construction**: Don't draw shapes; sum simple directional fields (waves) overlapping in space to let complexity emerge from interference.
- **Structural Controls**: Use the number of waves and their angular separation to drive symmetry and order. Even spacing creates crystals; irregular spacing creates strange hybrids.
- **Field Equations over Object Placement**: Evaluate a formula everywhere (per pixel/sample) rather than manually placing decorative motifs.
- **Phase Animation**: Animate the pattern by shifting the phase of the underlying waves over time, making the structure itself feel alive.
- **Response Functions**: Exchange the base function (e.g., swapping `cos` for `tan`) to radically alter the emotional texture from elegant interference to noisy turbulence.
- **Signal Remapping**: Remap the summed intensity (folding, wrapping, thresholding) to define the final visible form. The pattern comes from how the field is interpreted.

### Lesson: Technical Implementation (GPU & Advanced Logic)
- **Reaction-Diffusion (GPU)**: Use WebGL and Ping-Pong buffers to run Gray-Scott equations. Store concentrations in Red/Green channels of data textures. Interpolate feed/kill rates based on underlying image brightness.
- **Multiple Neighborhoods CA (MNCA)**: Upgrade standard CA to check multiple, progressively larger neighborhood patterns. Maintain two 2D arrays for current/next states to avoid overwriting during calculation.
- **Object-Oriented Fractals**: Use classes to store vertices and midpoints. Project inward "struts" using trig. Use Perlin noise to vary strut length (Noise Inversion) for chaotic, shifting geometry.
- **3D Flow Fields & Verlet Physics**: Use 3D noise (x, y, time) for animated flow fields. Use Verlet integration (position - previous position) for stable soft bodies. Apply inverse kinematic constraints by manually adjusting point distances to rest lengths.
- **GPU Instancing & Post-Processing**: Use Simplex noise for faster GPU performance. Use instancing (`instanceID`) to render thousands of particles simultaneously. Implement Bloom by blurring a scene in a separate framebuffer and adding it back with additive blending.

### Lesson: Reaction-Diffusion (CPU)
- **The Overwrite Problem**: You cannot overwrite the grid while processing it, as new cell states depend on the *previous* states of neighbors.
- **Two-Array Solution**: Maintain `current` and `next` arrays. Read from `current`, write to `next`, then swap (`current = next`) after the full grid pass.
- **Laplacian (Neighborhood Blur)**: Calculate diffusion by weight-summing a 3x3 neighborhood (center = -1, adjacent = 0.2, diagonal = 0.05).
- **Reaction Equation**: Apply `A * B * B` reaction logic with uniform feed and kill rates.
- **Direct Pixel Manipulation**: Use the `pixels` array instead of `rect()` for performance.
- **Optimization**: Run multiple mathematical iterations per visual frame to speed up growth.

### Lesson: MNCA Optimization via Convolutions
- **Multiple Neighborhoods**: Evaluate four distinct, progressively larger neighborhood patterns (`sum_0` to `sum_3`) per cell.
- **Threshold Logic**: Apply specific birth/death ranges to these sums (e.g., death if `sum_3 > 108`, life if `sum_0` is 40-42).
- **Channel Packing**: Optimize by packing four neighborhood patterns into the Red, Green, Blue, and Alpha channels of a single convolution kernel.
- **Single Pass Execution**: Perform the convolution once to yield a matrix where each pixel's RGBA values contain the four neighborhood sums simultaneously.
- **Hardware Acceleration**: This technique is ideal for WebGL shaders or FFT-based math libraries to maintain high frame rates with large neighborhoods.

### Lesson: Advanced CA (History, Probability, & Topology)
- **State History & Transitions**: Track `current` and `previous` states to color transitional events (e.g., birth vs. death). Map cell "age" (consecutive frames) to color gradients for rich visuals.
- **Probabilistic & Continuous Rules**: Introduce randomness to survival conditions (e.g., 80% death chance) to make patterns feel organic. Use floating-point states (0.0-1.0) for soft fading and ghosting trails.
- **Non-Rectangular & Dynamic Grids**: Use hexagonal grids or untether cells entirely, treating them as moving particles (boids) with neighborhoods that change based on physical proximity.
- **Pixel-Level Performance**: For massive colonies, map states directly to the `pixels` array instead of using `rect()` or `ellipse()` to avoid performance bottlenecks.
- **Memory & Topology**: Pre-allocate `current` and `next` arrays during setup and swap them to avoid GC thrashing. Implement "wrap-around" (toroidal) logic for seamless, infinite edges.

### Lesson: Continuous Cellular Automata (Lenia)
- **Continuous States**: Move beyond discrete 0/1 states to continuous values (0.0 to 1.0) per pixel. This creates fluid, biological "creatures" that move and interact like microscopic life.
- **Circular Kernels**: Use circular neighborhoods (kernels) instead of square grids to calculate neighbor influences.
- **Growth Functions**: Apply growth functions (like a Bell curve) to the neighborhood sums to determine the rate of change for each cell.
- **Microscopic Realism**: This approach yields emergent behaviors that feel physically grounded and organic, moving away from the "grid-like" feel of traditional CA.

### Lesson: 4D Spatial Mechanics & Projections
- **4D Rotation Planes**: Rotations in 4D occur around 2D planes (XY, XZ, XW, YZ, YW, ZW). Use 4x4 transformation matrices and multiply them by 4D vectors `[x, y, z, w]`.
- **4D to 3D Projection**: Project a 4D point to 3D space using a perspective scalar based on the `w` axis: `1 / (distance - w)`. Multiply `x, y, z` by this scalar.
- **3D to 2D Projection**: Handled by the Vertex Shader in WebGL or abstracted by libraries like Three.js. It involves trigonometric transformations to map 3D points to the 2D screen.
- **CPU-Based Projection**: For pure Canvas 2D, center the origin via `translate(width/2, height/2)`. Apply perspective projection: `z_scale = 1 / (distance - z)`. Multiply `x` and `y` by `z_scale`.
- **Architecture**: Use **Three.js** for higher-dimensional or complex 3D visualizations. It abstracts matrix math, shader compilation, and buffer management.
- **4D Perspective Scalar Implementation**:
    1. **Define 4D Camera Distance**: Establish a distance along the $w$-axis.
    2. **Calculate Scalar**: `w_scale = 1 / (distance - w)`.
    3. **Project**: `x' = x * w_scale`, `y' = y * w_scale`, `z' = z * w_scale`.
- **WebGL Pipeline**: Pass projected 3D vertices to Three.js. The Vertex Shader handles the final projection to the 2D screen by setting `gl_Position` using model-view and projection matrices.
- **Optimization (Simplex vs Perlin)**: Standard noise requires $2^N$ corner interpolations (16 in 4D). Simplex noise uses $N+1$ corners (5 in 4D), reducing complexity by 11 corners. It also eliminates directional artifacts and uses a smoother quintic interpolation curve ($6x^5 - 15x^4 + 10x^3$).
- **Vector Projection & Dot Product**: Calculate the 4D dot product as `(Ax*Bx) + (Ay*By) + (Az*Bz) + (Aw*Bw)`. Project vector A onto B by normalizing B, taking the dot product of A and B_normalized (scalar projection), and multiplying B_normalized by that scalar.
- **4D Simplex Implementation**:
    - **Skewing**: Transform coordinates to simplex space using $F_4 = (\sqrt{5}-1)/4$.
    - **Traversal**: Identify the simplex cell by comparing magnitudes of skewed coordinates (e.g., $x > y > z > w$).
    - **Unskewing**: Map back to standard space using $G_4 = (5-\sqrt{5})/20$.
- **Verification Note**: Specific mathematical formulas for 4D-to-3D projection, 4D vector operations, and Simplex constants are drawn from outside information and should be independently verified before deployment.

### Lesson: Lindenmayer Systems (L-systems)
- **Formal Grammar**: Use an **Axiom** (starting string) and **Production Rules** (e.g., `A -> AB`) to recursively generate complex strings.
- **String Rewriting**: Iterate through the current string, applying rules to each character. Use an array and `.join('')` for performance when building massive strings (exponential growth).
    - **Optimization**: Avoid `+=` concatenation on strings (immutable objects). Instead, push replacement characters into an array buffer and `.join('')` at the end of the generation. This replicates the `StringBuffer` pattern to prevent memory crashes during exponential expansion.
- **Turtle Graphics**: Translate the final string into visual geometry using a virtual "turtle."
    - `F`: Draw forward + translate.
    - `G`: Move forward (no draw).
    - `+` / `-`: Rotate right/left.
    - `[` / `]`: **Push/Pop Matrix** (`ctx.save()` / `ctx.restore()`) to handle branching structures like trees.
- **Recursive Complexity**: L-systems excel at modeling biological growth, fractals (Koch curve, Cantor set), and self-similar architectures.
