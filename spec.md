```markdown
# Flappy Helicopter Frame Specification

## 1. OVERVIEW

### Core Functionality
- Side-scrolling obstacle avoidance game with continuous rightward movement
- Tap-to-ascend mechanics (press = right+up, release = right+down)
- Procedurally generated obstacle patterns
- Real-time distance counter
- Collision detection system
- Game over state with restart capability

### UX Flow
1. Initial frame: Start screen with tutorial graphic
2. Gameplay frame: Dynamic canvas with player avatar/obstacles
3. Score display: Persistent distance counter overlay
4. Collision frame: 
   - "Game Over" splash 
   - Final distance achieved
   - Restart button
   - Share score button

## 2. TECHNICAL REQUIREMENTS

### Responsive Design
- Canvas element scales proportionally to viewport
- Touch target areas ≥48px
- Landscape orientation lock via CSS
- Dynamic viewport units (dvh/dvw) for mobile layout
- Media queries for aspect ratio adjustments

### Performance
- RequestAnimationFrame for smooth animation
- Object pooling for obstacle instances
- Debounced touch event handlers
- Canvas layer composition (background/midground/foreground)

## 3. FRAMES v2 IMPLEMENTATION

### Interactive Elements
- Full-screen canvas for game rendering
- Touch/click event listeners for thrust control
- Dynamic meta tag updates for score sharing
- LocalStorage for personal best tracking

### Input Handling
- `pointerdown`/`touchstart` for ascent
- `pointerup`/`touchend` for descent
- Frame SDK message passing for state persistence
- Haptic feedback patterns via navigator.vibrate

### Social Features
- Shareable game states through Frame metadata
- Signed message payloads for score verification
- Deep link generation for challenge invites
- OpenGraph protocol for score cards

## 4. MOBILE CONSIDERATIONS

### Responsive Techniques
- Viewport-relative scaling (vmin/vmax units)
- Touch-action: manipulation CSS property
- Prevent-default on touch events
- Mobile-first media queries (hover: none)

### Touch Patterns
- Thumb-zone optimized controls
- Visual tap ripple feedback
- 300ms click delay prevention
- Edge-to-edge canvas interaction

## 5. CONSTRAINTS COMPLIANCE

### Storage Strategy
- LocalStorage for device-specific best scores
- SessionStorage for run-time state
- Frame metadata for shareable game states

### Architecture Limits
- Pure client-side execution
- No persistence beyond device storage
- All game logic in browser runtime
- Frame SDK as sole external dependency

### Complexity Controls
- Fixed obstacle generation patterns
- Simplified collision hitboxes
- Linear difficulty progression
- Basic particle effects only
```