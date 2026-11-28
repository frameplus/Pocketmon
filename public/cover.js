(() => {
  const intro = document.getElementById('henry-intro');
  const image = intro.querySelector('img');
  const dismiss = () => intro.remove();
  intro.addEventListener('click', dismiss);
  image.decode().then(() => setTimeout(dismiss, 1800), dismiss);
  setTimeout(dismiss, 4500);
})();
