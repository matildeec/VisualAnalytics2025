// Utility per caricare e mappare i documenti per id
export async function loadDocumentsMap() {
  const res = await fetch('/data/documents.json');
  const docs = await res.json();
  // Crea una mappa id -> documento
  const docMap = {};
  for (const doc of docs) {
    docMap[doc.id] = doc;
  }
  return docMap;
}
