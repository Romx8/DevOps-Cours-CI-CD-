const API_URL = '/api';

const healthElement = document.querySelector('#health');
const productsElement = document.querySelector('#products');

document.querySelector('#check-api').addEventListener('click', async () => {
  try {
    const response = await fetch(`${API_URL}/health`);
    const data = await response.json();

    healthElement.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    healthElement.textContent = `Erreur : ${error.message}`;
  }
});

document.querySelector('#load-products').addEventListener('click', async () => {
  productsElement.innerHTML = '<p>Chargement...</p>';

  try {
    const response = await fetch(`${API_URL}/products`);
    const products = await response.json();

    productsElement.innerHTML = products.map(product => `
      <article class="product">
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        <p class="price">${(product.price_cents / 100).toFixed(2)} €</p>
        <p>Stock : ${product.stock}</p>
      </article>
    `).join('');
  } catch (error) {
    productsElement.innerHTML = `<p>Erreur : ${error.message}</p>`;
  }
});
