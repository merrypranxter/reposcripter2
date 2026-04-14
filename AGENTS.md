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
- **Reaction Equation (Gray-Scott)**: Apply `A * B * B` reaction logic. Chemical A is added at a "feed rate", Chemical B is removed at a "kill rate".
- **Direct Pixel Manipulation**: Use the `pixels` array instead of `rect()` for performance.
- **Optimization**: Run multiple mathematical iterations per visual frame to speed up growth.

### Lesson: MNCA Optimization via Convolutions
- **Multiple Neighborhoods**: Evaluate four distinct, progressively larger neighborhood patterns (`sum_0` to `sum_3`) per cell.
- **Threshold Logic**: Apply specific birth/death ranges to these sums (e.g., death if `sum_3 > 108`, life if `sum_0` is 40-42).
- **Channel Packing**: Optimize by packing four neighborhood patterns into the Red, Green, Blue, and Alpha channels of a single convolution kernel.
- **Single Pass Execution**: Perform the convolution once to yield a matrix where each pixel's RGBA values contain the four neighborhood sums simultaneously.
- **Hardware Acceleration**: This technique is ideal for WebGL shaders or FFT-based math libraries to maintain high frame rates with large neighborhoods.

### Lesson: Advanced CA (History, Probability, & Topology)
- **Dual-Buffering (Simultaneity Paradox)**: Always maintain `current` and `next` arrays. Calculate `next` by reading from `current`, then swap: `current = next`.
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
    - **Implementation**:
      ```javascript
      let nextBuffer = [];
      for (let i = 0; i < current.length; i++) {
        let c = current.charAt(i);
        if (rules[c]) nextBuffer.push(rules[c]);
        else nextBuffer.push(c);
      }
      current = nextBuffer.join('');
      ```
- **Stochastic L-Systems**: Introduce probability to rules (e.g., `A -> AB` 70% of the time, `A -> AC` 30%). This ensures organic variation.
- **Turtle Graphics**: Translate the final string into visual geometry using a virtual "turtle."
    - `F`: Draw forward + translate.
    - `G`: Move forward (no draw).
    - `+` / `-`: Rotate right/left.
    - `[` / `]`: **Push/Pop Matrix** (`ctx.save()` / `ctx.restore()`) to handle branching structures like trees.
- **Recursive Complexity**: L-systems excel at modeling biological growth, fractals (Koch curve, Cantor set), and self-similar architectures.

### Lesson: Koch Curve L-system
- **Grammar**: Alphabet `{F, L, R}`.
- **Axiom**: `F`.
- **Rules**: `F -> FLFRFLF`.
- **Turtle Commands**:
    - `F`: Move forward + draw.
    - `L`: Turn left by 60°.
    - `R`: Turn right by 120°.
- **Growth**: Generation 0 is a line; Generation 1 is a peak; subsequent generations create recursive fractal edges.

### Lesson: Autonomous Agents & Flocking (Boids)
- **Concept**: Emergent group dynamics from simple local rules. An autonomous agent perceives its environment and calculates actions without a central leader.
- **Steering Formula**: `steering force = desired velocity - current velocity`. This acts as an error-correction mechanism.
- **The Three Core Rules**:
    - **Separation (Avoidance)**: Steer away from crowding neighbors. Calculate vectors pointing away from close neighbors, normalize, and divide by distance (flee more aggressively from closer threats).
    - **Alignment (Copy)**: Steer in the same direction as local flockmates. Calculate the average velocity of neighbors within a radius.
    - **Cohesion (Center)**: Steer toward the center of mass of local neighbors. Calculate the average location of neighbors and "seek" that target.
- **Implementation**: Accumulate these forces with adjustable weights.
- **Advanced Perception & Rules**:
    - **Field of View**: Limit perception to a forward-facing geometric cone.
    - **View (Gary Flake)**: Move laterally away from any boid that blocks the view.
    - **Obstacle Avoidance**: If an obstacle is detected within a threshold, calculate a desired velocity pointing exactly away from it. Apply the steering formula.
- **Optimization (Spatial Hash Grid / Bin-Lattice)**: Divide the canvas into a 2D grid. Agents only check neighbors in their own and adjacent cells. This reduces complexity from $O(N^2)$ to nearly $O(N)$.

### Lesson: Steering Behaviors (Seek & Flee)
- **Seek**: `desired velocity = target - position`. Normalize and scale to `maxspeed`.
- **Flee**: `desired velocity = position - target`. Normalize and scale to `maxspeed`.
- **Steering Calculation**: `force = desired - velocity`. Limit the magnitude by `maxforce` to simulate physical turning constraints.
- **Arrival**: Slow down as the agent approaches the target by scaling `desired velocity` based on distance when within a "slowing radius".

### Lesson: Force Fields & Repellers
- **Repellers**: Objects that push agents away.
- **Calculation**: Calculate a vector pointing from the repeller to the agent. Scale the force to be inversely proportional to the distance squared ($1/d^2$).
- **Weighting**: Avoidance/Repulsion forces are typically weighted higher than flocking forces (e.g., `avoid * 3.0` vs `cohesion * 1.0`) to prioritize survival over formation.

### Lesson: Cellular Automata (CA) Variations
- **1D/2D CA**: Grids of cells evolving based on neighbor states.
- **Game of Life**: Standard 2D survival/birth rules.
- **Vichniac Vote**: Models conformity; cell changes state if it's in the minority.
- **Brian's Brain**: Three states (Firing, Resting, Off); resembles neural synapse firing.

### Lesson: Evolutionary Computing & Genetic Algorithms
- **Genotype**: Digital DNA (data structure). An array of parameters (0.0 to 1.0) representing traits.
- **Phenotype**: Visual expression/behavior of the DNA (e.g., a specific fractal tree).
- **Fitness Function**: Numerical evaluation of performance.
- **Interactive Selection (IEC)**: Use the **User as the Fitness Function**. Evolve art based on user preference.
- **Selection**: Mating pool of successful genotypes.
- **Variation**: Crossover (mixing DNA) and Mutation (randomly flipping bits).
- **Vibecode Trick**: Map DNA to **Shader Uniforms** to evolve the logic of light and texture.

### Lesson: Artificial Neural Networks (Perceptrons)
- **Perceptron**: Simple model receiving multiple inputs, processing with weights, and producing an output.
- **Activation Functions**: Use `tanh` or `Sigmoid` to squash outputs between 0 and 1.
- **Learning**:
    - **Supervised**: Correcting errors based on known answers.
    - **Reinforcement**: Learning from environmental feedback (rewards/penalties).
- **Application**: Teaching agents to steer, recognize patterns, or adapt. Use as a **Brush Controller** to map inputs (speed, position) to visual traits (weight, hue).

### Lesson: Neuroevolution (NEAT)
- **Brain-Body Connection**: Give agents "sensors" (probes) and a Neural Network brain.
- **Evolving Topology**: Don't just evolve weights; evolve the architecture (adding/removing neurons).
- **Emergent Creativity**: Agents learn complex behaviors (e.g., swimming against currents) through generations of selection.

### Lesson: Advanced Physics & Libraries
- **Libraries**: Use **Box2D** or **toxiclibs** for complex mechanics.
- **Capabilities**: Polygon collisions, pendulums, elastic bridges, and joint constraints.
- **Efficiency**: Offload exhaustive collision math to specialized engines.

### Lesson: Verlet Integration (Physics of Squish)
- **Verlet Logic**: Store **Previous Position** instead of velocity. `velocity = currentPos - previousPos`.
- **Constraints (Relaxation Loop)**: Move points until they are the "correct" distance apart. Incredibly stable for ropes, cloth, and soft bodies.
- **Soft-Body Morphing**: Connect points with Verlet "sticks". Inflate shapes by increasing internal stick lengths.

### Lesson: Fluid Dynamics (Navier-Stokes)
- **Eulerian Grid**: Divide screen into cells storing Velocity and Density.
- **Advection**: Move density along velocity vectors.
- **Diffusion**: Spread density/velocity to neighbors.
- **Pressure/Divergence**: Balance "stuff" in cells to ensure incompressibility.
- **GPU Acceleration**: Use shader passes for Advection, Jacobi Iteration (pressure), and Divergence.

### Lesson: Reaction-Diffusion (Gray-Scott)
- **Gray-Scott Model**: Simulates chemical reaction/diffusion.
- **Parameters**:
    - **Feed Rate**: Addition of Chemical A.
    - **Kill Rate**: Removal of Chemical B.
    - **Diffusion Rate**: Spread to neighbors.
- **Visuals**: Brain coral, zebra stripes, cellular mitosis.

### Lesson: GLSL Shaders & Visual Effects
- **Vertex Shaders**: Transform geometry.
- **Fragment Shaders**: Define per-pixel color.
- **Effects**:
    - **Fresnel Effect**: View-dependent material appearance.
    - **Post-Processing**: High-performance visual filters.
- **Advanced Rendering**: Ray marching and SDFs for infinite fractals and complex lighting.

### Lesson: Ray Marching & Signed Distance Functions (SDFs)
- **Architecture**: Every pixel emits a virtual ray into the 3D scene. The ray steps forward based on the shortest signed distance to the nearest surface (SDF).
- **GPU Optimization**: Ray marching is ideal for GLSL fragment shaders, enabling real-time rendering of fractals and complex mathematical manifolds.
- **SDF Logic**: Use SDFs to define geometry mathematically (e.g., `length(p) - radius` for a sphere) rather than using explicit polygons.

### Lesson: Non-Euclidean Spaces & Hyperbolic Art
- **Mirror Rooms & Polyhedral Manifolds**: Space wraps around. Use **Modular Arithmetic** on Ray Marching positions: `p = mod(p, roomSize) - 0.5 * roomSize;`.
- **Hyperbolic Tiling (Poincaré Disk)**: Parallel postulate fails. Objects shrink infinitely as they approach the disk boundary.
- **Artistic Application**: Map L-Systems onto a hyperbolic plane for Escher-like "Circle Limit" effects.

### Lesson: Differential Growth (Math of Wrinkles)
- **Nodes and Springs**: Represent a boundary as connected nodes with Attraction (spring) and Repulsion (collision avoidance).
- **Injection**: If neighbors get too far apart, inject a new node.
- **Curvature-Based Injection**: Inject nodes where curvature is highest to create fractal-like ruffles (brains, kale, coral).

### Lesson: Strange Attractors (Portraits of Chaos)
- **Lorenz & Clifford Attractors**: Iterative functions sensitive to initial conditions.
- **Rendering**: Use **Additive Blending** and millions of semi-transparent points.
- **Density Mapping**: Map local hit-counts to HDR color ramps in a shader.

### Lesson: Domain Warping (Sculpting with Noise)
- **Nested Transformations**: `f(p) = noise( p + noise( p + noise( p ) ) )`.
- **GLSL Implementation**: Use **Fractional Brownian Motion (FBM)** octaves.
- **Vibe Shift**: Warp Worley noise with FBM for textures like stretched tissue or obsidian.

### Lesson: Particle-Life (Behavioral Chemistry)
- **Interaction Matrix**: Define attraction/repulsion forces between different "colors" of particles.
- **Emergent Taxonomy**: Evolve the matrix using Genetic Algorithms to discover complex multicellular-like organisms.

### Lesson: Coordinate Systems (Euclidean vs Polar/Spherical)
- **Euclidean (Cartesian)**: Standard $X/Y/Z$ grid. Best for linear, grid-based structures.
- **Polar (2D)**: Defined by radius ($r$) and angle ($\theta$). Best for circular paths and radial symmetry.
    - **Conversion**: $x = r \cdot \cos(\theta)$, $y = r \cdot \sin(\theta)$.
- **Spherical (3D)**: Defined by radius ($r$), azimuthal angle ($\theta$), and polar angle ($\phi$).
    - **Conversion**: $x = r \cdot \sin(\phi) \cdot \cos(\theta)$, $y = r \cdot \sin(\phi) \cdot \sin(\theta)$, $z = r \cdot \cos(\phi)$.

### Lesson: The Book of Shaders - Algorithmic Drawing
- **Shaping Functions**: Use `step(edge, x)` for binary thresholds and `smoothstep(edge0, edge1, x)` for smooth transitions. Use `pow()`, `exp()`, `log()`, and `sqrt()` to warp the linear flow of values.
- **Color Spaces**:
    - **HSB**: More intuitive for color picking. Map `x` to Hue and `y` to Brightness.
    - **YUV**: Used for analog encoding; bandwidth-efficient chrominance.
- **Polar Coordinates**: Convert Cartesian `(x, y)` to Polar `(r, theta)` using `length(st)` and `atan(y, x)`. This is essential for circular patterns and radial symmetry.
- **Distance Fields (SDF)**: Define shapes by the distance from a point to the shape's boundary.
    - **Circle**: `length(st - center) - radius`.
    - **Rectangle**: `max(abs(st.x), abs(st.y)) - size`.
    - **Combining**: Use `min()` for union, `max()` for intersection, and `clamp(a-b)` for subtraction.
- **2D Matrices**:
    - **Translate**: `st + offset`.
    - **Rotate**: `mat2(cos(a), -sin(a), sin(a), cos(a)) * st`.
    - **Scale**: `mat2(s.x, 0.0, 0.0, s.y) * st`.
    - **Order Matters**: Always translate to origin before rotating or scaling, then translate back.
- **Tiling & Patterns**:
    - **Fract**: Use `fract(st * zoom)` to repeat space.
    - **Truchet Tiles**: Use random rotation per cell to create infinite non-repeating paths.
    - **Offset Patterns**: Use `mod(row, 2.0)` to offset every other row (brick pattern).
- **Generative Design**:
    - **2D Random**: `fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453)`.
    - **2D Noise**: Interpolate between random values at the four corners of a grid cell.
    - **Fractal Brownian Motion (FBM)**: Sum multiple octaves of noise with increasing frequency and decreasing amplitude.
- **Image Processing**:
    - **Textures**: Use `texture2D(u_tex, st)` to sample images. Coordinates are normalized (0.0 to 1.0).
    - **Blending Modes**: Implement Photoshop-style blends (Multiply, Screen, Overlay, Color Dodge) using math macros.
