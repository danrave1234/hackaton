document.addEventListener('DOMContentLoaded', () => {
  console.log('Simple Blank Project: DOM is ready.');
  const btn = document.getElementById('helloBtn');
  if (btn) {
    btn.addEventListener('click', () => {
      alert('Hello! Your simple project is set up.');
    });
  }
});
