const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const crypto = require('crypto'); // Para generar sessionString
const app = express();

app.use(express.json());

// Configuración de Sequelize
const sequelize = new Sequelize('database-2', 'admin', 'golazo12', {
    host: 'database-2.cwmamnerktos.us-east-1.rds.amazonaws.com',
    dialect: 'mysql',
});

const AWS = require('aws-sdk');

// Configuración del S3 para subir un archivo
AWS.config.update({
    accessKeyId: 'ASIAUTLZMNPJJDG5CBI2',
    secretAccessKey: 'N4lSgfOwUq52AfeuhBIq7FCTR7ibFyvTsn19k2fv',
    sessionToken: 'IQoJb3JpZ2luX2VjEK', // Opcional
    region: 'us-east-1',
});
const s3 = new AWS.S3();

const subirArchivoAS3 = async () => {
    const bucketName = 'bucketdgo'; // Cambia por el nombre de tu bucket
    const archivoPath = 'C:/Users/dgo28/Downloads/cat_test.jpg'; // Ruta con barras normales

    const key = `alumnos/1/${Date.now()}_cat_test.jpg`; // Define una ruta única en S3

    try {
        // Leer el archivo local
        const archivo = fs.readFileSync(archivoPath);

        // Configuración del archivo a subir
        const params = {
            Bucket: bucketdgo,
            Key: key,
            Body: archivo,
            ContentType: 'image/jpeg', 
            ACL: 'public-read', // Hace que el archivo sea accesible públicamente
        };

        // Subir archivo
        const resultado = await s3.upload(params).promise();

        console.log('Archivo subido exitosamente:', resultado.Location);
    } catch (error) {
        console.error('Error al subir el archivo:', error);
    }
};


// Definición de modelos
const Alumno = sequelize.define('Alumno', {
    nombres: { type: DataTypes.STRING, allowNull: false },
    apellidos: { type: DataTypes.STRING, allowNull: false },
    matricula: { type: DataTypes.STRING, allowNull: false },
    promedio: { type: DataTypes.FLOAT, allowNull: false },
    fotoPerfilUrl: { type: DataTypes.STRING, allowNull: true },
    password: { type: DataTypes.STRING, allowNull: false },
});

const Profesor = sequelize.define('Profesor', {
    nombres: { type: DataTypes.STRING, allowNull: false },
    apellidos: { type: DataTypes.STRING, allowNull: false },
    numeroEmpleado: { type: DataTypes.STRING, allowNull: false },
    horasClase: { type: DataTypes.INTEGER, allowNull: false },
});

const SesionAlumno = sequelize.define('SesionAlumno', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    fecha: { type: DataTypes.INTEGER, allowNull: false }, // Unix timestamp
    alumnoId: { type: DataTypes.INTEGER, allowNull: false },
    active: { type: DataTypes.BOOLEAN, defaultValue: true },
    sessionString: { type: DataTypes.STRING(128), allowNull: false },
});

// Relaciones
Alumno.hasMany(SesionAlumno, { foreignKey: 'alumnoId' });
SesionAlumno.belongsTo(Alumno, { foreignKey: 'alumnoId' });

// Sincronización con la base de datos
(async () => {
    try {
        await sequelize.authenticate();
        console.log('Conexión con la base de datos establecida exitosamente.');
        await sequelize.sync({ alter: true }); // Crea o actualiza las tablas si es necesario
    } catch (error) {
        console.error('Error al conectar con la base de datos:', error);
    }
});




// Funciones de validación
function validarAlumno(data) {
    const requiredFields = ['nombres', 'apellidos', 'matricula', 'promedio', 'password'];
    for (const field of requiredFields) {
        if (!data[field]) {
            return { isValid: false, message: `El campo ${field} es obligatorio y no puede estar vacío.` };
        }
    }
    if (typeof data.promedio !== 'number') {
        return { isValid: false, message: "El promedio debe ser un número." };
    }
    return { isValid: true };
}

function validarFotoPerfilUrl(data) {
    if (!data.fotoPerfilUrl) {
        return { isValid: false, message: "El campo fotoPerfilUrl es obligatorio." };
    }
    return { isValid: true };
}

// Endpoints para alumnos
app.get('/alumnos', async (req, res) => {
    try {
        const alumnos = await Alumno.findAll();
        res.status(200).json(alumnos);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener alumnos' });
    }
});

app.get('/alumnos/:id', async (req, res) => {
    try {
        const alumno = await Alumno.findByPk(req.params.id);
        if (!alumno) return res.status(404).json({ error: "Alumno no encontrado" });
        res.status(200).json(alumno);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener el alumno' });
    }
});

app.post('/alumnos', async (req, res) => {
    const { isValid, message } = validarAlumno(req.body);
    if (!isValid) return res.status(400).json({ error: message });

    try {
        const alumno = await Alumno.create(req.body);
        res.status(201).json(alumno);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear el alumno' });
    }
});

app.put('/alumnos/:id', async (req, res) => {
    const { isValid, message } = validarAlumno(req.body);
    if (!isValid) return res.status(400).json({ error: message });

    try {
        const alumno = await Alumno.findByPk(req.params.id);
        if (!alumno) return res.status(404).json({ error: "Alumno no encontrado" });

        await alumno.update(req.body);
        res.status(200).json(alumno);
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar el alumno' });
    }
});

app.delete('/alumnos/:id', async (req, res) => {
    try {
        const alumno = await Alumno.findByPk(req.params.id);
        if (!alumno) return res.status(404).json({ error: "Alumno no encontrado" });

        await alumno.destroy();
        res.sendStatus(200);
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar el alumno' });
    }
});


app.post('/alumnos/:id/fotoPerfil', upload.single('fotoPerfil'), async (req, res) => {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
        return res.status(400).send({ error: 'Se requiere una imagen en la solicitud' });
    }

    try {
        // Llama a la función que ya tienes para subir el archivo
        const filePath = file.path;
        const key = `alumnos/${id}/${file.filename}`; // Generar ruta única
        const s3Url = await subirArchivoAS3(filePath, key); // Reutilizar tu función

       // Buscar o crear el alumno en la base de datos
       let alumno = await Alumno.findByPk(id);

       if (!alumno) {
           // Si el alumno no existe, lo creamos
           alumno = await Alumno.create({
               id,
               nombre: `Alumno ${id}`, // O personaliza el nombre como prefieras
               fotoPerfil: s3Url
           });
       } else {
           // Si el alumno existe, actualizamos la URL de la foto de perfil
           alumno.fotoPerfil = s3Url;
           await alumno.save();
       }

       // Eliminar el archivo local después de subirlo
       fs.unlinkSync(filePath);

        res.status(200).send({ message: 'Foto de perfil subida exitosamente', url: s3Url });
    } catch (error) {
        console.error('Error al subir la foto de perfil:', error);
        res.status(500).send({ error: 'Error al subir la foto de perfil' });
    }
});


// Endpoints para manejo de sesiones
app.post('/alumnos/:id/session/login', async (req, res) => {
    const { password } = req.body;

    try {
        const alumno = await Alumno.findByPk(req.params.id);
        if (!alumno) return res.status(404).json({ error: "Alumno no encontrado" });

        if (alumno.password !== password) {
            return res.status(400).json({ error: "Contraseña incorrecta" });
        }

        const sessionString = crypto.randomBytes(64).toString('hex');
        const nuevaSesion = await SesionAlumno.create({
            fecha: Math.floor(Date.now() / 1000),
            alumnoId: alumno.id,
            sessionString,
        });

        res.status(201).json({ message: "Sesión iniciada", session: nuevaSesion });
    } catch (error) {
        res.status(500).json({ error: 'Error al iniciar sesión' });
    }
});

app.post('/alumnos/:id/session/verify', async (req, res) => {
    const { sessionString } = req.body;

    try {
        const sesion = await SesionAlumno.findOne({
            where: { alumnoId: req.params.id, sessionString },
        });

        if (!sesion || !sesion.active) {
            return res.status(400).json({ error: "Sesión inválida o inactiva" });
        }

        res.status(200).json({ message: "Sesión válida" });
    } catch (error) {
        res.status(500).json({ error: 'Error al verificar la sesión' });
    }
});

app.post('/alumnos/:id/session/logout', async (req, res) => {
    const { sessionString } = req.body;

    try {
        const sesion = await SesionAlumno.findOne({
            where: { alumnoId: req.params.id, sessionString },
        });

        if (!sesion) {
            return res.status(400).json({ error: "Sesión no encontrada" });
        }

        sesion.active = false;
        await sesion.save();

        res.status(200).json({ message: "Sesión cerrada exitosamente" });
    } catch (error) {
        res.status(500).json({ error: 'Error al cerrar la sesión' });
    }
});

// Manejo de rutas no encontradas
app.use((req, res, next) => {
    res.status(404).json({ error: "Ruta no encontrada" });
});



//DynamoDb

const dynamodb = new AWS.DynamoDB.DocumentClient();

// Insertar un registro en una tabla
const params = {
    TableName: 'sesiones-alumnos',
    Item: {
        id: '123',
        nombre: 'Juan Pérez',
        edad: 25,
    },
};

dynamodb.put(params, (err, data) => {
    if (err) {
        console.error('Error al insertar en DynamoDB:', err);
    } else {
        console.log('Registro insertado:', data);
    }
});


//SNS

// Crear una instancia de SNS
const sns = new AWS.SNS();
const mensaje = `
      Hola,

      Aquí están los detalles del usuario con ID ${alumno.alumnoId}:

      Nombre: ${alumno.nombre}
      Apellido: ${alumno.apellidos}
      Correo electrónico: ${alumno.promedio}
      
      Saludos.
    `;
// Definir el contenido del correo
const params2 = {
  Message: mensaje,
  Subject: 'Calificacion',
  TopicArn: 'arn:aws:sns:us-east-1:316471536594:correo:ebdba164-1f26-4592-be4c-4a0ecac7f9aa',  // ARN de tu tópico SNS
  MessageAttributes: {
    'email': {
      DataType: 'String',
      StringValue: 'A21216267@alumnos.uady.mx'  // Correo verificado
    }
  }
};

// Publicar en el tópico SNS
sns.publish(params, (err, data) => {
  if (err) {
    console.log("Error al enviar el correo:", err);
  } else {
    console.log("Correo enviado con éxito:", data);
  }
});

// Inicio del servidor
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor en ejecución en http://localhost:${PORT}`);
});
