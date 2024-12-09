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


// Función para cargar fotos de perfil de múltiples alumnos
/*const cargarFotosDeAlumnos = async () => {
  try {
    // 1. Obtén todos los alumnos de la base de datos
    const alumnos = await Alumno.findAll();

    if (!alumnos.length) {
      console.log('No se encontraron alumnos en la base de datos.');
      return;
    }

    // 2. Define la carpeta con las fotos de los alumnos
    const carpetaFotos = './fotos'; // Cambia esto por tu carpeta local

    for (const alumno of Alumnos) {
      const fotoPath = path.join(carpetaFotos, `${Alumno.alumnoId}.jpg`); // Archivo debe llamarse como el ID del alumno
      if (!fs.existsSync(fotoPath)) {
        console.log(`No se encontró foto para el alumno con ID ${Alumno.alumnoId}.`);
        continue;
      }

      // 3. Prepara el archivo para subir
      const formData = new FormData();
      formData.append('foto', fs.createReadStream(fotoPath));

      // 4. Enviar la solicitud al endpoint
      try {
        const response = await axios.post(
          `http://localhost:3000/alumnos/${Alumno.alumnoId}/fotoPerfil`,
          formData,
          { headers: formData.getHeaders() }
        );
        console.log(`Foto de ${Alumno.nombre} subida exitosamente: ${response.data.fotoPerfilUrl}`);
      } catch (error) {
        console.error(`Error al subir la foto de ${Alumno.nombre}: ${error.message}`);
      }
    }
  } catch (error) {
    console.error('Error general:', error.message);
  } finally {
    await sequelize.close(); // Cierra la conexión a la base de datos
  }
};

cargarFotosDeAlumnos();
*/

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

// Endpoint para subir foto de perfil
app.post('/alumnos/:id/fotoPerfil', upload.single('foto'), async (req, res) => {
  try {
    const alumno = await Alumno.findByPk(req.params.id);
    if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado.' });

    const params = {
      Bucket: S3_BUCKET,
      Key: alumnos/${uuid.v4()}-${req.file.originalname},
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      ACL: 'public-read'
    };

    const uploadResult = await s3.upload(params).promise();
    alumno.fotoPerfilUrl = uploadResult.Location;
    await alumno.save();

    res.status(200).json({ fotoPerfilUrl: uploadResult.Location });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
