// Network Background Animation
(function() {
  const canvas = document.getElementById('network-canvas');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  let animationId;
  let nodes = [];
  let mouse = { x: 0, y: 0 };
  
  const nodeCount = 50;
  const connectionDistance = 150;
  const nodeSpeed = 0.5;
  const nodeRadius = 2;
  
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  
  function createNode() {
    return {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * nodeSpeed,
      vy: (Math.random() - 0.5) * nodeSpeed,
      radius: nodeRadius
    };
  }
  
  function initNodes() {
    nodes = [];
    for (let i = 0; i < nodeCount; i++) {
      nodes.push(createNode());
    }
  }
  
  function updateNodes() {
    nodes.forEach(node => {
      node.x += node.vx;
      node.y += node.vy;
      
      // Bounce off edges
      if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
      if (node.y < 0 || node.y > canvas.height) node.vy *= -1;
      
      // Keep nodes in bounds
      node.x = Math.max(0, Math.min(canvas.width, node.x));
      node.y = Math.max(0, Math.min(canvas.height, node.y));
    });
  }
  
  function distance(node1, node2) {
    const dx = node2.x - node1.x;
    const dy = node2.y - node1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw connections
    ctx.strokeStyle = 'rgba(255, 136, 0, 0.15)';
    ctx.lineWidth = 1;
    
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dist = distance(nodes[i], nodes[j]);
        if (dist < connectionDistance) {
          const opacity = 1 - (dist / connectionDistance);
          ctx.strokeStyle = `rgba(255, 136, 0, ${opacity * 0.15})`;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
      
      // Draw connection to mouse if close
      const mouseDist = Math.sqrt(
        Math.pow(mouse.x - nodes[i].x, 2) + 
        Math.pow(mouse.y - nodes[i].y, 2)
      );
      if (mouseDist < connectionDistance) {
        const opacity = 1 - (mouseDist / connectionDistance);
        ctx.strokeStyle = `rgba(255, 136, 0, ${opacity * 0.2})`;
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.stroke();
      }
    }
    
    // Draw nodes
    ctx.fillStyle = 'rgba(255, 136, 0, 0.4)';
    nodes.forEach(node => {
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    
    updateNodes();
  }
  
  function animate() {
    draw();
    animationId = requestAnimationFrame(animate);
  }
  
  function handleMouseMove(e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }
  
  // Initialize
  resizeCanvas();
  initNodes();
  
  // Event listeners
  window.addEventListener('resize', () => {
    resizeCanvas();
    initNodes();
  });
  
  window.addEventListener('mousemove', handleMouseMove);
  
  // Start animation
  animate();
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
  });
})();
