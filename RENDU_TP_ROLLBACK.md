# Rendu TP rollback TrainShop

## 1. État initial

Containers observés après `docker compose up -d --build` :

```
NAME                 IMAGE                          SERVICE    STATUS
trainshop_proxy      nginx:1.27-alpine              proxy      Up (port 80)
trainshop_frontend   devops-cours-ci-cd--frontend   frontend   Up
trainshop_api        devops-cours-ci-cd--api        api        Up (port 3000)
trainshop_db         postgres:16-alpine             db         Up healthy
```

Endpoints testés :

```bash
$ curl http://localhost/api/health
{"status":"ok","service":"trainshop-api","database":"connected"}

$ curl http://localhost/api/products
[{"id":1,"name":"Billet Lyon → Paris",...},{"id":2,...},{"id":3,...},{"id":4,...}]
```

Architecture : un proxy nginx sur le port 80 route `/api/*` vers l'API Express (port 3000) et `/` vers le frontend statique. La base PostgreSQL est initialisée via `database/init/001-init.sql`.

---

## 2. Version stable

```
Commit stable : c701d9e  fix volumes SELinux : ajout :z sur les mounts db et proxy
Tag stable    : v1.0.0-stable
```

```bash
$ git log --oneline
c701d9e fix volumes SELinux : ajout :z sur les mounts db et proxy
421e0dd ajout proxy nginx et séparation routes products
...

$ git tag
v1.0.0-stable
```

---

## 3. CI/CD stable

Tests API (Jest + Supertest) :

```
PASS tests/products.test.js
PASS tests/health.test.js

Test Suites: 2 passed, 2 total
Tests:       2 passed, 2 total
```

Build Docker :

```
Image devops-cours-ci-cd--api       Built
Image devops-cours-ci-cd--frontend  Built
```

Workflow GitHub Actions : **vert** sur `https://github.com/Romx8/DevOps-Cours-CI-CD-/actions`

Jobs exécutés :
- `Tester API` — npm install + npm test : OK
- `Vérifier les builds Docker` — docker build api + frontend : OK

---

## 4. Sauvegarde PostgreSQL

```bash
$ docker exec trainshop_db pg_dump -U postgres postgres > backup-db-before-tp.sql
$ ls -lh backup-db-before-tp.sql
-rw-r--r--. 1 rom rom 2,4K 1 juin 11:38 backup-db-before-tp.sql
```

Fichier SQL : `backup-db-before-tp.sql`
Taille : **2,4 Ko**

---

## 5. Modification applicative

Fichiers modifiés :
- `frontend/src/index.html` — titre `TrainShop — Version TP` + badge visible dans le header
- `frontend/src/app.js` — affichage dynamique `Application en cours : v1.1.0-tp`

Commit de version :

```
0b0f145  ajout affichage version TP
Tag      v1.1.0-tp
```

Rebuild :

```bash
docker compose up -d --build frontend proxy
curl http://localhost/
# → <title>TrainShop — Version TP</title>
# → <p class="badge">Version TP — rollback &amp; CI/CD</p>
```

---

## 6. Test automatisé /api/products

Fichier de test : `api/tests/products.test.js`

```js
describe('GET /products', () => {
  it('should return products list', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Guide Docker', ... }] });
    const response = await request(app).get('/products');
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe('Guide Docker');
  });
});
```

Sortie avant incident :

```
PASS tests/products.test.js
PASS tests/health.test.js

Tests: 2 passed, 2 total
```

---

## 7. Incident contrôlé

Symptôme : `GET /api/products` retourne systématiquement `500` au lieu de la liste des produits.

Fichier modifié : `api/src/routes/products.js`

```js
// Avant (version stable)
router.get('/', async (req, res) => {
  const result = await pool.query('SELECT ... FROM products ORDER BY id ASC');
  res.json(result.rows);
});

// Après (incident)
router.get('/', async (req, res) => {
  res.status(500).json({ error: 'Incident simulé : endpoint products hors service' });
});
```

Commit incident : `7ce448b  simulation incident endpoint products`

Sortie du test en échec :

```
FAIL tests/products.test.js
  ● GET /products › should return products list

    Expected: 200
    Received: 500

      25 |     expect(response.status).toBe(200);

Test Suites: 1 failed, 1 passed, 2 total
Tests:       1 failed, 1 passed, 2 total
```

---

## 8. Diagnostic

Cause identifiée : modification volontaire du handler `GET /` dans `api/src/routes/products.js` — la route retourne un 500 fixe sans interroger la base.

Preuves :

```bash
$ git diff v1.1.0-tp..HEAD -- api/src/routes/products.js
-  try {
-    const result = await pool.query('SELECT ... FROM products ...');
-    res.json(result.rows);
-  } catch (error) { ... }
+  res.status(500).json({ error: 'Incident simulé : endpoint products hors service' });
```

```bash
$ curl http://localhost/api/health
{"status":"ok","service":"trainshop-api","database":"connected"}
# → La base PostgreSQL est intacte, l'API tourne

$ curl http://localhost/api/products
{"error":"Incident simulé : endpoint products hors service"}
# → L'erreur est dans le code, pas dans les données
```

Conclusion : la base de données n'est pas en cause. L'incident est purement applicatif, limité à un seul fichier et un seul commit. Le rollback doit porter sur le code uniquement.

---

## 9. Rollback

Commande Git utilisée :

```bash
git revert HEAD --no-edit
# → [main ac54da0] Revert "simulation incident endpoint products"
```

Rebuild de l'API :

```bash
docker compose up -d --build api
```

Tests après rollback :

```
PASS tests/products.test.js
PASS tests/health.test.js

Test Suites: 2 passed, 2 total
Tests:       2 passed, 2 total
```

Sortie du test après rollback :

```bash
$ curl http://localhost/api/products
[
  {"id":1,"name":"Billet Lyon → Paris","price_cents":4500,"stock":20},
  {"id":2,"name":"Billet Lyon → Marseille","price_cents":3900,"stock":15},
  {"id":3,"name":"Guide Docker débutant","price_cents":1900,"stock":50},
  {"id":4,"name":"Pack GitHub Actions","price_cents":2900,"stock":30}
]
```

Historique Git final :

```
ac54da0 Revert "simulation incident endpoint products"
7ce448b simulation incident endpoint products
0b0f145 ajout affichage version TP
c701d9e fix volumes SELinux : ajout :z sur les mounts db et proxy
421e0dd ajout proxy nginx et séparation routes products
```

Aucun `docker compose down -v` utilisé — les volumes PostgreSQL sont intacts.

---

## 10. Conclusion

Ce TP a permis de mettre en pratique le cycle complet d'un incident en environnement DevOps :

- **Git comme filet de sécurité** : le tag `v1.0.0-stable` et la commande `git revert` permettent de revenir proprement sur une version saine sans réécrire l'historique.
- **Séparation code / données** : le rollback applicatif (code) est indépendant des données PostgreSQL. Les deux ne se gèrent pas de la même façon — `git revert` pour le code, `pg_dump` / restauration pour la base.
- **Les tests comme détecteur d'incident** : le test automatisé `products.test.js` a permis de confirmer objectivement l'incident (rouge) et le succès du rollback (vert), sans ambiguïté.
- **CI/CD comme garde-fou** : le workflow GitHub Actions valide à chaque push que le build et les tests passent, empêchant de pousser un code cassé sans le détecter.
