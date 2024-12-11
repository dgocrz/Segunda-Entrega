const express = require('express');
const bodyParser = require('body-parser');
const { Sequelize, DataTypes } = require('sequelize');
const AWS = require('aws-sdk');
const uuid = require('uuid');
const multer = require('multer');
const bcrypt = require('bcrypt');


const app = express(); // Esto debe estar antes de app.use

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configuración AWS
const AWS_ACCESS_KEY = 'ASIAUTLZMNPJMNJTH22J';
const AWS_SECRET_KEY = 'ObfUMP/YCUc314p4evermmGU2NCP/mBNAX3RQcyp';
const AWS_SESSION_TOKEN = 'IQoJb3JpZ2luX2VjEN///////////wEaCXVzLXdlc3QtMiJGMEQCIFIsZYPI3NRJ22/HYFQ0e+Orxtjr9LPSDaA6YbVTDczuAiASQ6UU2MM2N7UIl9Hu+2/mwZJPVFPjciYlY5ZSLFbcxCq9AgiY//////////8BEAAaDDMxNjQ3MTUzNjU5NCIMB5w9xEx3C3ohIinUKpECw1BUKpYOxgi3XzoN5e8YrFfiRbix/RoPGkTNtO0JzH+LZIoZ0POoHkE9/Al5lGcHmfK82/3b518/UX0UNp5TdkCgD/LE7R9L1Sh9a45VQ40iXhLEiXTA8JiMG4rbZyZRdQVfar7+dHgZS/4xMWEuy5+GxZ/FVm61vwWXVCYjW9bG/PYzQVGJOMGIyII6w/sJtaO11QVyjrrYyvJHRQB2vcqo3vxcUBBr+hByUj9Fc+n7lUOEfKMA1oAPDSOJ6afAUQmT3+0WMLBYcXikWQ4S1/p7kBEIANbcqOZbpcHPvrgERf8RTVwQYIpt306wiH4ZxGiy+l+7YyhyczrDxXHqMPLJ4ST745i6t7LaaRCefIiNML6Q47oGOp4B5VxSX0RgwQjJyQm1w/H9y7+hSe4e/3g5dQW+YA4aJzyAi9qKXKVUMa2lt7AswBX5C14Y6tlHrZqnjpkh5A14ZjZKaBLvFuDlpd3t6iVkAwCG5HIcZzbnVecdFhxDfsQ4gFEeG0Ykon46N3RHXOYRVmEEX42I54Rb0cyupaczeYeiKoViiP0LuSyZor/fXub75uyyH1JW6ReoT2jehnk=';
const AWS_REGION = 'us-east-1';
const SNS_TOPIC_ARN = 'arn:aws:sns:us-east-1:316471536594:Correo:5f39a629-c248-4360-bb50-c7d6a802bec3';
const S3_BUCKET = 'bucketdgo';

AWS.config.update({
  accessKeyId: AWS_ACCESS_KEY,
  secretAccessKey: AWS_SECRET_KEY,
  sessionToken: AWS_SESSION_TOKEN,
  region: AWS_REGION
});
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({ 
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY,
    secretAccessKey: AWS_SECRET_KEY,
    sessionToken: AWS_SESSION_TOKEN
  }
});

//const s3 = new AWS.S3();
const sns = new AWS.SNS();
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Configuración de base de datos
const DB_NAME = 'base1';
const DB_USER = 'admin';
const DB_PASSWORD = 'golazo12';
const DB_HOST = 'database-1.cwmamnerktos.us-east-1.rds.amazonaws.com';
const DB_PORT = 3306;

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  dialect: 'mysql',
  port: DB_PORT
});



// Definición de modelos
const Alumno = sequelize.define('Alumno', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombres: { type: DataTypes.STRING, allowNull: true },
  apellidos: { type: DataTypes.STRING, allowNull: true },
  matricula: { type: DataTypes.STRING, allowNull: true },
  promedio: { type: DataTypes.FLOAT, allowNull: true },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    set(value) {
      const salt = bcrypt.genSaltSync(10);
      this.setDataValue('password', bcrypt.hashSync(value, salt));
    }
  },
  fotoPerfilUrl: { type: DataTypes.STRING, allowNull: true }
});

const Profesor = sequelize.define('Profesor', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  numeroEmpleado: { type: DataTypes.STRING, allowNull: true },
  nombres: { type: DataTypes.STRING, allowNull: true },
  apellidos: { type: DataTypes.STRING, allowNull: true },
  horasClase: { type: DataTypes.INTEGER, allowNull: true }
});

// Configuración de Multer para subida de archivos
const upload = multer({ storage: multer.memoryStorage() });

// Funciones de validación
function validarAlumno(data) {
  const requiredFields = ['nombres', 'apellidos', 'matricula', 'promedio', 'password'];
  for (const field of requiredFields) {
    if (!data[field]) return { isValid: false, message: `El campo ${field} es obligatorio.` };
  }
  if (typeof data.promedio !== 'number') return { isValid: false, message: 'El promedio debe ser un número.' };
  return { isValid: true };
}

function validarProfesor(data) {
  if (!data.nombres || data.nombres.trim() === '') {
    return { isValid: false, message: 'El campo nombres es obligatorio.' };
  }
  if (!data.apellidos) {
    return { isValid: false, message: 'El campo apellidos es obligatorio.' };
  }
  if (!data.numeroEmpleado) {
    return { isValid: false, message: 'El campo numeroEmpleado es obligatorio.' };
  }
  if (typeof data.horasClase !== 'number' || data.horasClase < 0) {
    return { isValid: false, message: 'Las horas de clase deben ser un número entero no negativo.' };
  }
  return { isValid: true };
}

function getRandomId() {
  return Math.floor(Math.random() * 10000).toString();
}

function getPromedio() {
  return parseFloat((Math.random() * 10).toFixed(2));
}

// Endpoints de alumnos
app.get('/alumnos', async (req, res) => {
  try {
    const alumnos = await Alumno.findAll();
    res.status(200).json(alumnos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/alumnos', async (req, res) => {
  const { isValid, message } = validarAlumno(req.body);
  if (!isValid) return res.status(400).json({ error: message });

  try {
    const alumno = await Alumno.create(req.body);
    res.status(201).json(alumno);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//Endpoint para S3

app.post('/alumnos/:id/fotoPerfil', upload.single('foto'), async (req, res) => {
  try {
    const alumno = await Alumno.findByPk(req.params.id);
    if (!alumno) {
      return res.status(404).json({ error: 'Alumno no encontrado.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No se ha proporcionado ninguna foto.' });
    }

    // Configuración de los parámetros de subida a S3
    const params = {
      Bucket: S3_BUCKET,
      Key: `alumnos/${uuid.v4()}-${req.file.originalname}`, // Nombre único
      Body: req.file.buffer, // Contenido del archivo
      ContentType: req.file.mimetype, // Tipo MIME
      ACL: 'public-read' // Asegura que la foto sea accesible públicamente
    };

    // Subir el archivo a S3
    try {
      const command = new PutObjectCommand(params);
      await s3Client.send(command);
    } catch (error) {
      console.error('Error al subir a S3:', error);
      return res.status(500).json({ error: 'No se pudo subir la foto a S3.' });
    }

    // Obtener la URL pública del archivo
    const fotoPerfilUrl = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${params.Key}`;
    alumno.fotoPerfilUrl = fotoPerfilUrl;
    await alumno.save();

    // Responder con la URL de la foto
    res.status(200).json({ fotoPerfilUrl });
  } catch (error) {
    console.error('Error en el endpoint /alumnos/:id/fotoPerfil:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Gestión de sesiones
app.post('/alumnos/:id/session/login', async (req, res) => {
  try {
    const { password } = req.body;
    const alumno = await Alumno.findByPk(req.params.id);
    if (!alumno || !bcrypt.compareSync(password, alumno.password)) {
      return res.status(400).json({ error: 'Credenciales inválidas.' });
    }

    // CHANGE: Generate a 128-character session string
    const sessionString = uuid.v4().repeat(4).slice(0, 128);

    await dynamoDB.put({
      TableName: 'sesiones-alumnos',
      Item: { 
        alumnoId: req.params.id, 
        sessionString, 
        active: true 
      }
    }).promise();

    res.status(200).json({ sessionString });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/alumnos/:id/session/logout', async (req, res) => {
  try {
    const { sessionString } = req.body;  // CHANGE: Add this line to get sessionString from request

    await dynamoDB.update({
      TableName: 'sesiones-alumnos',
      Key: { 
        alumnoId: req.params.id,
        sessionString: sessionString  // CHANGE: Use the specific sessionString
      },
      UpdateExpression: 'SET active = :inactive',
      ExpressionAttributeValues: { ':inactive': false }
    }).promise();

    res.status(200).json({ message: 'Sesión cerrada.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Retrieve an Alumno by ID
app.get('/alumnos/:id', async (req, res) => {
  try {
    const alumno = await Alumno.findByPk(req.params.id);
    if (!alumno) {
      return res.status(404).json({ error: 'Alumno no encontrado.' });
    }
    res.status(200).json(alumno);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update an Alumno by ID
app.put('/alumnos/:id', async (req, res) => {
  const { isValid, message } = validarAlumno(req.body);
  if (!isValid) return res.status(400).json({ error: message });

  try {
    const alumno = await Alumno.findByPk(req.params.id);
    if (!alumno) {
      return res.status(404).json({ error: 'Alumno no encontrado.' });
    }
    await alumno.update(req.body);
    res.status(200).json(alumno);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Endpoints de profesores
app.get('/profesores', async (req, res) => {
  try {
    const profesores = await Profesor.findAll();
    res.status(200).json(profesores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/profesores', async (req, res) => {
  const { isValid, message } = validarProfesor(req.body);
  if (!isValid) return res.status(400).json({ error: message });

  try {
    const profesor = await Profesor.create(req.body);
    res.status(201).json(profesor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/profesores/:id', async (req, res) => {
  try {
    const profesor = await Profesor.findByPk(req.params.id);
    if (!profesor) {
      return res.status(404).json({ error: 'Profesor no encontrado.' });
    }
    res.status(200).json(profesor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/profesores/:id', async (req, res) => {
  const { isValid, message } = validarProfesor(req.body);
  if (!isValid) return res.status(400).json({ error: message });

  try {
    const profesor = await Profesor.findByPk(req.params.id);
    if (!profesor) {
      return res.status(404).json({ error: 'Profesor no encontrado.' });
    }
    await profesor.update(req.body);
    res.status(200).json(profesor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/profesores/:id', async (req, res) => {
  try {
    const profesor = await Profesor.findByPk(req.params.id);
    if (!profesor) {
      return res.status(404).json({ error: 'Profesor no encontrado.' });
    }
    await profesor.destroy();
    res.status(200).json({ message: 'Profesor eliminado.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify Session
app.post('/alumnos/:id/session/verify', async (req, res) => {
  try {
    const { sessionString } = req.body;
    const session = await dynamoDB.get({
      TableName: 'sesiones-alumnos',
      Key: { 
        alumnoId: req.params.id,
        sessionString: sessionString  // CHANGE: Specify the exact sessionString
      }
    }).promise();

    if (session.Item?.sessionString === sessionString && session.Item.active) {
      return res.status(200).json({ message: 'Sesión válida.' });
    }
    res.status(400).json({ error: 'Sesión inválida o expirada.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/alumnos/:id', async (req, res) => {
  try {
    const alumno = await Alumno.findByPk(req.params.id);
    if (!alumno) {
      return res.status(404).json({ error: 'Alumno no encontrado.' });
    }
    
    await alumno.destroy();
    res.status(200).json({ message: 'Alumno eliminado exitosamente.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.post('/alumnos/:id/send-email', async (req, res) => {
    try {
        const alumno = await Alumno.findByPk(req.params.id);
        if (!alumno) {
            return res.status(404).json({ error: 'Alumno no encontrado.' });
        }

        const params = {
            Message: `Email para alumno: ${alumno.nombres} ${alumno.apellidos}`,
            TopicArn: SNS_TOPIC_ARN
        };

        await sns.publish(params).promise();
        res.status(200).json({ message: 'Email enviado exitosamente' });
    } catch (error) {
        console.error('Error al enviar correo:', error);
        res.status(500).json({ error: 'Error al enviar el correo.' });
    }
});
  
app.all('/alumnos/:id/fotoPerfil', (req, res) => {
    if (!['POST', 'GET'].includes(req.method)) {
        return res.status(405).json({ error: 'Método no permitido.' });
    }
});

// Sincronización e inicio del servidor
const PORT = 3000;
sequelize.sync()
  .then(() => {
    app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
  })
  .catch(error => console.error('Error al iniciar:', error));
