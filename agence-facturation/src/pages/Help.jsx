// Page d'aide : sert le manuel client (fichier statique public/manuel.html)
// dans un cadre plein écran. React Router possède l'URL /aide, ce qui la rend
// accessible en dev comme en production sans configuration serveur particulière.
// Le manuel gère lui-même sa langue (ar/fr) et son thème.
export default function Help() {
  return (
    <iframe
      src="/manuel.html"
      title="Manuel d'utilisation Wakalaty"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: "none" }}
    />
  );
}
