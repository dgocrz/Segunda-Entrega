const express = require('express');
const bodyParser = require('body-parser');
const { Sequelize, DataTypes } = require('sequelize');
const AWS = require('aws-sdk');
const uuid = require('uuid');
const multer = require('multer');
const bcrypt = require('bcrypt');

const app = express();
//const axios = require('axios');
//const FormData = require('form-data');
//const fs = require('fs');
//const path = require('path');

// Middlewares
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configuración AWS
const AWS_ACCESS_KEY = 'ASIAUTLZMNPJEN727FYV';
const AWS_SECRET_KEY = '8GTGKTBi++DSK0fyCwdEYJchJJ7O7204UznVOjO8';
const AWS_SESSION_TOKEN = 'IQoJb3JpZ2luX2VjEK7//////////wEaCXVzLXdlc3QtMiJHMEUCIQDkamPc7z9zXKU7ia0ufAvzNpsxcuGDpP1uYknvtxlykwIgfTnZyTS7OSL/LMtkC5QjS5uRnqlko2aGD8bCOcZKyuYqtAIIZxAAGgwzMTY0NzE1MzY1OTQiDBLBoUjF5znydl5a4SqRAjhg1e3jkpKfFRKMBq8bLoyK6JzttfI+TDESSgoLeb25CJZd39eDlM2MbfvTIYJfrWIitq39Pyf850yLp9oAItbez+YwiWv27PEdeChcH3syEdBlAZx7z8oQaQ/NK1PQ3nB24wKmsitdanHRRu6YZs8GDrEldt4k6XRZd1Zf95HXe+0+7xShaSpCMPNiCpF5d2+mqx3R1LvmE2p8/B/Xs3QpH76XaOIRKeMEeXXsfksbgrglf8bXp9GE8YcUl8zP3zIs+0HxI1+GJ2xpFcHhrpbEfWYWl0qNUPSmgbRkHCPHHcWRQBaib4EpSwZamTb4wso6Gz1MwQ9xBRwc80eGtVQduvAXr4lnun+AybDfdhW0lTCLoti6BjqdAd5RZ1AMLctcdb0RUIMKbK9hY/GaghqSoP2JrxVJdjV2yEum0+30Y+xhmgmbLPy5c7CQ4JY47I6YFJrExVUWyptaD2E1i2/uLcDWsCzPzF5YJ7WY5bzuGv1JLfSb7quICBU6On9YxIWSkPnJWgR/GNAHFU+aptDP6cH3Fl6griPT2F3UQB/vf3f8Tepf4scYO0wauVbQJDf8uwKQEiI';
const AWS_REGION = 'us-east-1';
const SNS_TOPIC_ARN = 'arn:aws:sns:us-east-1:316471536594:Correo:5f39a629-c248-4360-bb50-c7d6a802bec3';
const S3_BUCKET = 'bucketdgo';

AWS.config.update({
  accessKeyId: AWS_ACCESS_KEY,
  secretAccessKey: AWS_SECRET_KEY,
  sessionToken: AWS_SESSION_TOKEN,
  region: AWS_REGION
});

const s3 = new AWS.S3();
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
  const requiredFields = ['numeroEmpleado', 'nombres', 'apellidos', 'horasClase'];
  for (const field of requiredFields) {
    if (!data[field]) return { isValid: false, message: `El campo ${field} es obligatorio.` };
  }
  if (typeof data.horasClase !== 'number' || !Number.isInteger(data.horasClase)) {
    return { isValid: false, message: 'Las horas de clase deben ser un número entero.' };
  }
  return { isValid: true };
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
      Key: `alumnos/${uuid.v4()}-${req.file.originalname}`, // Nombre único del archivo en S3
      Body: req.file.buffer, // Contenido del archivo
      ContentType: req.file.mimetype, // Tipo MIME del archivo
      ACL: 'public-read', // Acceso público al archivo
    };

    // Subir el archivo a S3
    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    // Obtener la URL pública del archivo
    const fotoPerfilUrl = `https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${params.Key}`;

    // Guardar la URL en el registro del alumno
    alumno.fotoPerfilUrl = fotoPerfilUrl;
    await alumno.save();

    // Responder con la URL de la foto
    res.status(200).json({ fotoPerfilUrl });
  } catch (error) {
    console.error('Error al subir la foto de perfil:', error);
    res.status(500).json({ error: 'Error al subir la foto de perfil.' });
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

    const sessionString = uuid.v4();
    await dynamoDB.put({
      TableName: 'sesiones-alumnos',
      Item: { alumnoId: req.params.id, sessionString, active: true }
    }).promise();

    res.status(200).json({ sessionString });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/alumnos/:id/session/logout', async (req, res) => {
  try {
    await dynamoDB.update({
      TableName: 'sesiones-alumnos',
      Key: { alumnoId: req.params.id },
      UpdateExpression: 'SET active = :inactive',
      ExpressionAttributeValues: { ':inactive': false }
    }).promise();

    res.status(200).json({ message: 'Sesión cerrada.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sincronización e inicio del servidor
const PORT = 3000;
sequelize.sync()
  .then(() => {
    app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
  })
  .catch(error => console.error('Error al iniciar:', error));
