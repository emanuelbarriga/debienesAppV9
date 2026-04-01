import { db } from '../src/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { Responsible } from '../src/types/responsible';

const createNAResponsible = async () => {
  try {
    const responsible: Omit<Responsible, 'id'> = {
      name: 'No Asignado',
      identificacion: 'N/A',
      email: '',
      phones: [],
      type: 'n/a',
      valor: 0,
      empresa: '',
      direccion: '',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await addDoc(collection(db, 'responsibles'), responsible);
    console.log('Registro N/A creado con ID:', docRef.id);
  } catch (error) {
    console.error('Error:', error);
  }
};

createNAResponsible();
